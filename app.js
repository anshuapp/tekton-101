/* ******************************
 * Tekton 101
 *
 * Simple nodejs app with some REST endpoints
 * - / main page, calls a backend service if defined
 * - /metrics Prometheus endpoint
 * 
 * Supported ENV
 * TEKTON_101_ENV_NAME
 * app name, default 'TEKTON_101'. Will be also used as ServiceName for Jaeger/OpenTracing.
 * Only alphanum is allowed, no whitespace or special chars.
 * 
 * TEKTON_101_ENV_EXAMPLE
 * holds any kind of value and will be displayed in / endpoint
 * 
 * TEKTON_101_ENV_DELAY
 * in milliseconds, default 1.000, to delay the processing
 * 
 * TEKTON_101_ENV_BACKEND_SERVICE
 * Complete URL to a backend service which will be called via HTTP GET 
 * and response will be added to the output of /. Default null, no backend service call.
 * 
 * TEKTON_101_ENV_BACKEND_SERVICE_DELAY
 * in milliseconds, default 0, to delay the backend service call
 * 
 * TEKTON_101_ENV_TRACING_ENABLED
 * Default false. Enable OpenTracing or not.
 * 
 * 
 * Integrated libs
 * - Prometheus
 * - Jaeger for OpenTracing (linked to Prometheus)
 * 
 * Idea
 * Create with this app a chain of relationships between the apps. Any new app could have use a previous started
 * version of the app as backend service. 
 * Very simple way to test and verify OpenTracing and work with Microservices aspects.
 * 
 * 
 * Usage
 * $ npm start
 * Without additional backend service
 * 
 * $ TEKTON_101_ENV_BACKEND_SERVICE=http://127.0.0.1:5001 TEKTON_101_ENV_DELAY=2000 TEKTON_101_ENV_BACKEND_SERVICE_DELAY=0 npm start
 * With a backend service and some delays
 * ******************************
*/

const promClient = require('prom-client');
const promBundle = require("express-prom-bundle");
const app = require('express')()
const axios = require('axios');

// ############# Prometheus 
// include HTTP method and URL path into the labels
const metricsMiddleware = promBundle({includeMethod: true, includePath: true});

app.use(metricsMiddleware);

// ############# Application configuration
app.set('port', (process.env.PORT || 5000))
app.set('ip', (process.env.IP || '0.0.0.0'))

app.set('envTektonName', (process.env.TEKTON_101_ENV_NAME || 'TEKTON_101'))

app.set('envTektonExample', (process.env.TEKTON_101_ENV_EXAMPLE || 'default value'))

app.set('envDelay', (process.env.TEKTON_101_ENV_DELAY || 1000))

app.set('envBackendService', (process.env.TEKTON_101_ENV_BACKEND_SERVICE || ''))

app.set('envBackendServiceDelay', (process.env.TEKTON_101_ENV_BACKEND_SERVICE_DELAY || 0))

app.set('envTracingEnabled', (process.env.TEKTON_101_ENV_TRACING_ENABLED || false))

// ############# Jaeger configuration
if(app.get('envTracingEnabled')) {

  const jaeger = require('jaeger-client');
  const jaegerInitTracer = jaeger.initTracer;
  var PrometheusMetricsFactory = jaeger.PrometheusMetricsFactory;

  var appName = app.get('envTektonName');
  var config = {
    serviceName: app.get('envTektonName'),
  };
  var metrics = new PrometheusMetricsFactory(promClient, config.serviceName);
  var options = {
    tags: {
      'tekton101.version': process.env.npm_package_version,
    },
    metrics: metrics
  };

  console.log('tracing enabled, initializing...')
  var tracer = jaeger.initTracerFromEnv(config, options);
}


// ############# Entry points
app.get('/info', (req, res) => {
  
  var ret = "[" + app.get('envTektonName') + "]: Hello from NodeJS Playground! TEKTON_101_ENV_EXAMPLE=" + app.get('envTektonExample');

  // simulated processing
  var processDelay = app.get('envDelay');
  sleep(processDelay).then(() => {
    ret = callBackendService(ret, req, res);
  });
  
});
 

// ############# Utilities
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

function callBackendService(ret, req, res) {

  var backendService = app.get('envBackendService');
  if (typeof backendService !== 'undefined' && backendService !== null && backendService !== '') {
    
    // wait before calling backend service
    var backendServiceDelay = app.get('envBackendServiceDelay');
    sleep(backendServiceDelay).then(() => {

      axios.get(backendService)
            .then(function (response) {
              console.log(response.status);
              ret = `${ret}\n${response.data}`;              
            })
            .catch(function (error) {
              // handle error
              console.log(error.message);
              ret = `${ret}\nBackendService Failed: ${error.message}`;
            })
            .finally(function () {
              
              // send the response to the client
              res.send(ret);
            });
    });
    

  }

  return ret;
}



app.listen(app.get('port'), app.get('ip'), function() {
  console.log("App.Version: " + process.env.npm_package_version)
  console.log("ENV.TEKTON_101: " + app.get('envTektonName'))
  console.log("ENV.TEKTON_101_ENV_EXAMPLE: " + app.get('envTektonExample'))
  console.log("ENV.TEKTON_101_ENV_DELAY: " + app.get('envDelay'))
  console.log("ENV.TEKTON_101_ENV_BACKEND_SERVICE: " + app.get('envBackendService'))
  console.log("ENV.TEKTON_101_ENV_BACKEND_SERVICE_DELAY: " + app.get('envBackendServiceDelay'))
  console.log("ENV.TEKTON_101_ENV_TRACING_ENABLED: " + app.get('envTracingEnabled'))
  
  console.log("Node app is running at localhost:" + app.get('port'))
})

module.exports.app = app;