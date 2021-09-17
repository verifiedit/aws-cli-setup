import {
  checkIfEnvironmentVariableIsOmitted,
  NullOutstreamStringWritable,
  TEMP_DIRECTORY
} from './utils'
import * as io from '@actions/io'
import os from 'os'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import path from 'path'

const START_SCRIPT_EXECUTION_MARKER = `Starting script execution via docker image https://hub.docker.com/r/amazon/aws-cli:`
const CONTAINER_WORKSPACE = '/github/workspace'
const CONTAINER_TEMP_DIRECTORY = '/_temp'

export const installAWSCli = async (version: string): Promise<void> => {
  const aliasCommand = await createAliasCommand(version)

  await setAlias('aws', aliasCommand)
}

const setAlias = async (alias: string, command: string): Promise<void> => {
  await executeAliasCommand(`${alias}=${command}`)
}

const createAliasCommand = async (version: string): Promise<string> => {
  const dockerTool: string = await io.which('docker', true)

  let environmentVariables = ''
  for (const key in process.env) {
    if (!checkIfEnvironmentVariableIsOmitted(key) && process.env[key]) {
      environmentVariables += ` -e "${key}=${process.env[key]} `
    }
  }
  const github_env_file_relative_path = path.relative(
    TEMP_DIRECTORY,
    process.env.GITHUB_ENV || ''
  )
  const CONTAINER_GITHUB_ENV = path.resolve(
    CONTAINER_TEMP_DIRECTORY,
    github_env_file_relative_path
  )

  let command = `${dockerTool} run --rm -ti --workdir ${CONTAINER_WORKSPACE} `
  command += ` -v ${process.env.GITHUB_WORKSPACE}:${CONTAINER_WORKSPACE} `
  command += ` -v ${process.env.HOME}/.aws:/root/.aws `
  command += ` -v ${TEMP_DIRECTORY}:${CONTAINER_TEMP_DIRECTORY} `
  command += ` ${environmentVariables} `
  command += ` -e GITHUB_WORKSPACE=${CONTAINER_WORKSPACE} `
  command += ` -e GITHUB_ENV=${CONTAINER_GITHUB_ENV} `
  command += ` amazon/aws-cli:${version}`

  return command
}

const executeAliasCommand = async (
  aliasCommand: string,
  continueOnError = false
): Promise<void> => {
  const aliasTool = 'alias'
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
        if (data.trim() === START_SCRIPT_EXECUTION_MARKER) {
          shouldOutputErrorStream = true
          errorStream = '' // Flush the container logs. After this, script error logs will be tracked.
        }
      }
    }
  }
  let exitCode
  try {
    exitCode = await exec.exec(
      `"${aliasTool}" ${aliasCommand}`,
      [],
      execOptions
    )
  } catch (error) {
    core.setFailed(error)
  } finally {
    if (exitCode !== 0 && !continueOnError) {
      core.setFailed(errorStream || 'unable to set aws alias')
    }
  }
}
