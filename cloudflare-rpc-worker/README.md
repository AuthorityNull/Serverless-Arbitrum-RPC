# Get started 

This project uses Cloudflare Workers to proxy Arbitrum' RPC endpoint.

# Configuration

## Environment Variables

To configure the worker, you will need to define the following Variables:

ARB_RPC_LIST - a comma delimited list of Arbitrum Endpoints
```https://arb1.arbitrum.io,https://your-rpc.domain.com```

FAILURE_ERROR_CODE_LIST - a comma delimited list of unacceptable error codes. In other words,error codes that indicate the RPC endpoint is down and should be removed.

```429,400,403,500```

FALLBACK_ARB_RPC_URL - a single RPC url that will stand in when all ARB_RPC_LIST entries have failed

```https://your-failback-rpc.domain.com```

LOGGING_ENABLED - to enable console logging from the worker.
```true```


## KV namespaces

When using the code that utilizes KV, you will need to define the following KV Namespace:

RPC_ERROR_LIST - A KV store that keeps track of failed RPC calls. This namespace is used to ensure all FAILED RPC URLs get filtered out of the ARB_RPC_LIST
* NOTE: Failed RPCs neeed to be removedd from this list in order to serve more RPC requests

#

# HAPPY RPC`ING!!!!
