import * as core from '@actions/core'
import {NullOutstreamStringWritable} from './utils'
import os from 'os'
import * as exec from '@actions/exec'
import {installAWSCli} from './installer'

export const run = async (): Promise<void> => {
  try {
    // version is optional. If not supplied, use `latest` tag.
    let version = core.getInput('awsCliVersion')
    if (!version) {
      version = 'latest'
    }

    // check that version exists
    if (!(await checkIfValidVersion(version))) {
      core.setFailed(
        'Please enter a valid aws cli version. \nSee available versions: https://hub.docker.com/r/amazon/aws-cli/tags.'
      )
    }

    await installAWSCli(version)
  } catch (error) {
    core.setFailed(error.message)
  }
}

const checkIfValidVersion = async (version: string): Promise<boolean> => {
  let outStream = ''
  // noinspection JSUnusedGlobalSymbols
  const execOptions: any = {
    outStream: new NullOutstreamStringWritable({decodeStrings: false}),
    listeners: {
      stdout: (data: any) => (outStream += `${data.toString()}${os.EOL}`)
    }
  }

  try {
    await exec.exec(
      `curl -sS https://registry.hub.docker.com/v2/repositories/amazon/aws-cli/tags/${version}`,
      [],
      execOptions
    )
    return !!(outStream && JSON.parse(outStream).name)
  } catch (error) {
    core.warning(
      `Unable to fetch aws cli versions. Output: ${outStream}, Error: ${error}`
    )
  }

  return false
}
