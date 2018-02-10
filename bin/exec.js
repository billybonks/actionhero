if(process.env.APM){
  require('newrelic');
}
const fs = require('fs')
const path = require('path')
const optimist = require('optimist')
const spawn = require('child_process').spawn

const actionheroRoot = path.normalize(path.join(__dirname, '..'))
let projectRoot

if (process.env.projectRoot) {
  projectRoot = process.env.projectRoot
} else if (process.env.project_root) {
  projectRoot = process.env.project_root
} else if (process.env.PROJECT_ROOT) {
  projectRoot = process.env.PROJECT_ROOT
} else {
  projectRoot = path.normalize(process.cwd())
}

const ActionheroPrototype = require(actionheroRoot + '/actionhero.js')
const actionhero = new ActionheroPrototype()
const configChanges = {}

function formatParams (api, runner) {
  let params = {}
  if (!runner.inputs) { runner.inputs = {} }

  Object.keys(runner.inputs).forEach((inputName) => {
    let collection = runner.inputs[inputName]
    let value = optimist.argv[inputName]

    if (collection.default && (value === undefined || value === null || value === '')) {
      if (typeof collection.default === 'function') {
        value = collection.default()
      } else {
        value = collection.default
      }
      api.log(`using default value of \`${value}\` for \`${inputName}\``)
    }

    if (collection.required === true && (value === undefined || value === null || value === '')) {
      api.log(`Error: \`${inputName}\` is a required command-line argument to the method \`${runner.name}\``, 'crit')
      // api.log(`You can provide it via \`${runner.name} --${inputName}=value\``)
      process.exit(1)
    }

    params[inputName] = value
  })

  return params
}

actionhero.initialize({configChanges: configChanges}, function (error, api) {
  if (error) { throw error }
  api._context = actionhero

  try {
    let runner
    let p = path.join(__dirname, 'methods', 'start.js')
    if (fs.existsSync(p)) {
      runner = require(p)
    } else {
      api.config.general.paths.cli.forEach((cliPaths) => {
        p = path.join(cliPaths, 'start.js')
        if (fs.existsSync(p)) { runner = require(p) }
      })
    }

    if (!runner) {
      api.log(`Error: start is not a method I can perform`, 'error')
      api.log('run `actionhero help` to learn more', 'error')
      setTimeout(process.exit, 500, 1)
    } else {
      api.log('--------------------------------------')
      api.log(`ACTIONHERO COMMAND >> start`)
      api.log(`projectRoot: ${path.normalize(projectRoot)}`, 'debug')
      api.log(`actionheroRoot: ${path.normalize(actionheroRoot)}`, 'debug')
      api.log('--------------------------------------')

      if (optimist.argv.daemon) {
        let newArgs = process.argv.splice(2)
        for (let i in newArgs) {
          if (newArgs[i].indexOf('--daemon') >= 0) { newArgs.splice(i, 1) }
        }
        newArgs.push('--isDaemon=true')
        const command = path.normalize(actionheroRoot + '/bin/actionhero')
        const child = spawn(command, newArgs, {detached: true, cwd: process.cwd(), env: process.env, stdio: 'ignore'})
        api.log(`${command} ${newArgs.join(' ')}`, 'debug')
        api.log(`spawned child process with pid ${child.pid}`, 'notice')
        process.nextTick(process.exit)
      } else {
        let params = formatParams(api, runner)
        runner.run(api, {params: params}, function (error, toStop) {
          if (error) { throw error }
          if (toStop || (arguments.length < 2 && !toStop)) { setTimeout(process.exit, 500, 0) }
        })
      }
    }
  } catch (e) {
    throw (e)
  }
})
