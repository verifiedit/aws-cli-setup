import * as stream from 'stream'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as os from 'os'

export const TEMP_DIRECTORY: string = process.env.RUNNER_TEMP || os.tmpdir()
export class NullOutstreamStringWritable extends stream.Writable {
  _write(data: any, encoding: string, callback: Function): void {
    if (callback) {
      callback()
    }
  }
}

export const dockerPullImage = async (
  image: string,
  version: string
): Promise<void> => {
  const dockerTool: string = await io.which('docker', true)

  let errorStream = ''
  let shouldOutputErrorStream = false
  // noinspection JSUnusedGlobalSymbols
  const execOptions: any = {
    outStream: new NullOutstreamStringWritable({decodeStrings: false}),
    listeners: {
      stdout: (data: any) => console.log(data.toString()), //to log the script output while the script is running.
      errline: (data: string) => {
        if (!shouldOutputErrorStream) {
          errorStream += data + os.EOL
        } else {
          console.log(data)
        }
        shouldOutputErrorStream = true
        errorStream = '' // Flush the container logs. After this, script error logs will be tracked.
      }
    }
  }
  let exitCode
  try {
    exitCode = await exec.exec(
      `"${dockerTool}" pull ${image}:${version}`,
      [],
      execOptions
    )
  } catch (error) {
    core.setFailed(error)
  } finally {
    if (exitCode !== 0) {
      core.setFailed(
        errorStream ||
          `unable to execute ${dockerTool} pull ${image}:${version}`
      )
    }
  }
}

export const checkIfEnvironmentVariableIsOmitted = (key: string): boolean => {
  const omitEnvironmentVariables: string[] = [
    'LANG',
    'HOSTNAME',
    'PWD',
    'HOME',
    'PYTHON_VERSION',
    'PYTHON_PIP_VERSION',
    'SHLVL',
    'PATH',
    'GPG_KEY',
    'CONDA',
    'AGENT_TOOLSDIRECTORY',
    'GITHUB_WORKSPACE',
    'GITHUB_ENV',
    'RUNNER_PERFLOG',
    'RUNNER_WORKSPACE',
    'RUNNER_TEMP',
    'RUNNER_TRACKING_ID',
    'RUNNER_TOOL_CACHE',
    'DOTNET_SKIP_FIRST_TIME_EXPERIENCE',
    'JOURNAL_STREAM',
    'DEPLOYMENT_BASEPATH',
    'VCPKG_INSTALLATION_ROOT',
    'PERFLOG_LOCATION_SETTING'
  ]

  const omitEnvironmentVariablesWithPrefix: string[] = [
    'JAVA_',
    'LEIN_',
    'M2_',
    'BOOST_',
    'GOROOT',
    'ANDROID_',
    'GRADLE_',
    'ANT_',
    'CHROME',
    'SELENIUM_',
    'INPUT_'
  ]
  for (const item of omitEnvironmentVariables) {
    if (item === key.toUpperCase()) {
      return true
    }
  }

  return omitEnvironmentVariablesWithPrefix.some((prefix: string) =>
    key.toUpperCase().startsWith(prefix)
  )
}
