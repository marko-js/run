# Loading

```html

    
<script>
  
      document.body.classList.remove('no-js')
    
</script>
```

```diff
-</script>+</script>


    
<main>
  
      
  <section
    class="card"
  >
    
        
    <header>
      
          
      <h1>
        
            
        <svg
          aria-hidden="true"
          class="sad"
          fill="none"
          height="22"
          viewBox="0 0 22 22"
          width="22"
          xmlns="http://www.w3.org/2000/svg"
        >
          
              
          <path
            clip-rule="evenodd"
            d="M11 21.5C16.799 21.5 21.5 16.799 21.5 11C21.5 5.20101 16.799 0.5 11 0.5C5.20101 0.5 0.5 5.20101 0.5 11C0.5 16.799 5.20101 21.5 11 21.5ZM12.125 6.125C12.125 5.82663 12.0065 5.54048 11.7955 5.3295C11.5845 5.11853 11.2984 5 11 5C10.7016 5 10.4155 5.11853 10.2045 5.3295C9.99353 5.54048 9.875 5.82663 9.875 6.125V11.375C9.875 11.6734 9.99353 11.9595 10.2045 12.1705C10.4155 12.3815 10.7016 12.5 11 12.5C11.2984 12.5 11.5845 12.3815 11.7955 12.1705C12.0065 11.9595 12.125 11.6734 12.125 11.375V6.125ZM12.5 15.5C12.5 15.8978 12.342 16.2794 12.0607 16.5607C11.7794 16.842 11.3978 17 11 17C10.6022 17 10.2206 16.842 9.93934 16.5607C9.65804 16.2794 9.5 15.8978 9.5 15.5C9.5 15.1022 9.65804 14.7206 9.93934 14.4393C10.2206 14.158 10.6022 14 11 14C11.3978 14 11.7794 14.158 12.0607 14.4393C12.342 14.7206 12.5 15.1022 12.5 15.5Z"
            fill="#900B31"
            fill-rule="evenodd"
          />
          
            
        </svg>
        
            This
            edge function
            has crashed
          
      </h1>
      
          
      <p>
        An unhandled error in the function code triggered the following message:
      </p>
      
          
      <p
        class="error-message-details hidden inline-code"
      >
        
            
        <span
          class="error-type"
        />
        <span
          class="error-message"
        />
        
          
      </p>
      
        
    </header>
    

        
    <pre
      class="raw-error-details"
    >
      <code>
        {"errorType":"TypeError","errorMessage":"window.postMessage is not a function","trace":["TypeError: window.postMessage is not a function\n    at indexBrowser$5.___setImmediate (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:14)\n    at safeRender (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:7)\n    at Template.render (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:16)\n    at pageResponse (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:7:32)\n    at Object.get1 [as handler] (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:10)\n    at invoke (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:36)\n    at fetch (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:18)\n    at default_edge_entry_default (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:26)\n    at https://65437779a0c9990008b54abe-[hash].netlify.com/bootstrap/function_chain.ts:401:15\n    at AsyncLocalStorage.run (node:async_hooks:224:13)"]}
      </code>
    </pre>
    

        
    <div
      class="stack-trace hidden"
    >
      
          
      <h3>
        Stack trace
      </h3>
      
          
      <pre>
        <code />
      </pre>
      
        
    </div>
    
      
  </section>
  
      
  <script>
    
        /* eslint eslint-comments/no-use: off */
        // eslint-disable-next-line func-names
        ;(function () {
          const rawErrorDetails = document.querySelector('.raw-error-details code').textContent
          const errorMessageDetailsElement = document.querySelector('.error-message-details')
          const errorTypeElement = document.querySelector('.error-type')
          const errorMessageElement = document.querySelector('.error-message')
          const stackTraceElement = document.querySelector('.stack-trace')
          const stackTraceCodeElement = document.querySelector('.stack-trace code')

          // Enriching the error details
          let parsedErrorDetails
          try {
            parsedErrorDetails = JSON.parse(rawErrorDetails.trim())
          } catch (error) {
            console.error(error)
            document.body.classList.add('no-js')
            return
          }

          if (!parsedErrorDetails) {
            return
          }

          const hasTrace =
            (Array.isArray(parsedErrorDetails.trace) && parsedErrorDetails.trace.length !== 0) ||
            (Array.isArray(parsedErrorDetails.stackTrace) && parsedErrorDetails.stackTrace.length !== 0)

          if (parsedErrorDetails && hasTrace) {
            stackTraceElement.classList.remove('hidden')
          }

          if (parsedErrorDetails.errorType) {
            // enriching error types via allowing them to be linked to a relevant MDN article if they are in the known list
            // https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/error#error_types
            const errorTypes = [
              'EvalError',
              'RangeError',
              'ReferenceError',
              'SyntaxError',
              'TypeError',
              'URIError',
              'AggregateError',
              'InternalError',
            ]
            if (errorTypes.includes(parsedErrorDetails.errorType)) {
              const mdnLink = document.createElement('a')
              mdnLink.href = `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/${parsedErrorDetails.errorType}`
              mdnLink.textContent = parsedErrorDetails.errorType
              mdnLink.target = '_blank'
              errorTypeElement.append(mdnLink)
            } else {
              errorTypeElement.textContent = parsedErrorDetails.errorType
            }
          }

          if (parsedErrorDetails.errorMessage || parsedErrorDetails.errorType) {
            errorMessageDetailsElement.classList.remove('hidden')
          }

          if (parsedErrorDetails.errorMessage) {
            errorMessageElement.textContent =
              (parsedErrorDetails.errorType ? ' - ' : ' ') + parsedErrorDetails.errorMessage
          }

          // Go errors currently use "stackTrace" with a different structure than "trace"
          // map these into a shared format.
          if (Array.isArray(parsedErrorDetails.stackTrace) && parsedErrorDetails.stackTrace.length !== 0) {
            parsedErrorDetails.trace = parsedErrorDetails.stackTrace.reduce((newTrace, traceDetail) =&gt; {
              let traceLine = ''
              if (traceDetail.path) {
                /* eslint-disable no-negated-condition */
                traceLine += `${traceDetail.path}${traceDetail.line !== undefined ? `:${traceDetail.line}` : ''} ${
                  traceDetail.label !== undefined ? `${traceDetail.label} ` : ''
                }`
                /* eslint-enable no-negated-condition */
                if (traceLine) {
                  newTrace.push(traceLine)
                }
              }
              return newTrace
            }, [])
          }

          if (Array.isArray(parsedErrorDetails.trace) && parsedErrorDetails.trace.length !== 0) {
            stackTraceCodeElement.textContent = parsedErrorDetails.trace.join('\n')
          } else {
            stackTraceCodeElement.remove()
          }
        })()
      
  </script>
</main>
```

```diff
-        class="error-message-details hidden inline-code"
+        class="error-message-details inline-code"
-        />
+        >
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError"
            target="_blank"
          >
            TypeError
          </a>
        </span>
-        />
+        >
           - window.postMessage is not a function
        </span>
-      class="stack-trace hidden"
+      class="stack-trace"
-        <code />
+        <code>
          TypeError: window.postMessage is not a function
    at indexBrowser$5.___setImmediate (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:14)
    at safeRender (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:7)
    at Template.render (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:16)
    at pageResponse (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:7:32)
    at Object.get1 [as handler] (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:10)
    at invoke (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:36)
    at fetch (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:18)
    at default_edge_entry_default (file:///Users/rturnquist/dev/marko/run/packages/run/src/__tests__/fixtures/netlify-adapter-page/netlify/edge-functions/index.js:9999:26)
    at https://65437779a0c9990008b54abe-[hash].netlify.com/bootstrap/function_chain.ts:401:15
    at AsyncLocalStorage.run (node:async_hooks:224:13)
        </code>

```

```diff
-</main>+  
    
</main>

  


```

