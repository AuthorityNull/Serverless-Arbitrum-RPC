/**
 * This worker will proxy incoming requests and submit a POST
 * requests to a given list of backend servers. Backend servers are configured
 * via Cloudflare's ENVIRONMENT variables. The Variable name is ARB_RPC_LIST
 *
 */

const pruneRPCFailedNodes = (logger, rpc_array, bad_rpc_array) => {
  logger(`[pruneRPCFailedNodes] - input =  ${rpc_array}, ${bad_rpc_array}`);
  let map = new Map();

  rpc_array.forEach((val, idx) => map.set(val, idx));

  if (bad_rpc_array) {
    bad_rpc_array.forEach((br) => {
      rpc_array.forEach((rpc) => {
        if (rpc == br.name) {
          map.delete(rpc);
        }
      });
    });
  }

  const output = rpc_array.filter((rpc) => {
    return map.has(rpc);
  });
  return output;
};

const fetchRPCUrlWinner = async (env, logger) => {
  logger(`[fetchRPCUrlWinner] ARB_RPC_LIST = ${env.ARB_RPC_LIST}`);

  //parse the list of configured RPC enpoints (https://rpc1,https://rpc2,etc..)
  //TODO: address COST of KV
  const bad_rpc_array = new Array();// await env.RPC_ERROR_LIST.list();
  logger(
    `[fetchRPCUrlWinner] RPC_ERROR_LIST = ${JSON.stringify(bad_rpc_array)}`
  );
  const rpc_urls = pruneRPCFailedNodes(
    logger,
    env.ARB_RPC_LIST.split(","),
    bad_rpc_array
  );

  // choose a random winner to "balance" the load across many RPC providers
  const winner = rpc_urls[Math.floor(Math.random() * rpc_urls.length)];
  logger(`[fetchRPCUrlWinner] winner = ${winner}`);
  return winner;
};

const buildResponse = async (env, logger, winner, rawResponse) => {
  try {
    let respBody = await rawResponse.json();
    const error_resp = `{"jsonrpc":"2.0","id":67,"error":{"code":-32601,"message":"the method et_version does not exist/is not available"}}`;
    //construct final response back to consumer
    logger(`[buildResponse] The response body is ${JSON.stringify(respBody)}`);
    let hasError = false;

    if (respBody.error) {
      const { code, message } = respBody.error;

      // these codes cause the node to be removed from the list of available nodes
      if (code) {
        const msg = `Internal Server Error error code [${code}] and message [${message}]`;
        logger(`[buildResponse] error code found in response`, msg);
        const fatalErrorCodes = env.FAILURE_ERROR_CODE_LIST;

        fatalErrorCodes.split(",").forEach((fatalErrorCode) => {
          const fc = parseInt(fatalErrorCode);
          logger(`${code == fc} ${code} == ${fc} ???`);
          if (code == fc) {
            hasError = true;
          }
        });
        logger(`[buildResponse] has error = ${hasError}`);

        if (hasError == true) {
          //TODO: address cost of KV
          //await env.RPC_ERROR_LIST.put(winner, Date.now());
          const error_resp = `{"jsonrpc":"2.0","id":-1,"error":{"code":${code},"message":"${message}"}}`;
          return new Response(error_resp, { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
    }
    console.log("resutnrning default boduy")
    return new Response(JSON.stringify(respBody), rawResponse);
  } catch (e) {
    const error_resp = `{"jsonrpc":"2.0","id":-1,"error":{"code":-1,"message":"unknown error ${JSON.stringify(e)}"}}`;
    return new Response(error_resp, { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export default {
  /**
   *
   *
   */
  async fetch(request, env, context) {
    console.log("[config] LOGGING_ENABLED = ", env.LOGGING_ENABLED);
    console.log("[config] ARB_RPC_LIST = ", env.ARB_RPC_LIST);
    console.log("[config] FAILURE_ERROR_CODE_LIST = ", env.FAILURE_ERROR_CODE_LIST);
    console.log("[config] FALLBACK_ARB_RPC_URL = ", env.FALLBACK_ARB_RPC_URL);

    const logger = (logMsg) => {
      if (env.LOGGING_ENABLED && env.LOGGING_ENABLED == "true") {
        console.log(logMsg);
      }
    };

    //pull the existing JSON text from the incoming request.
    const body = await request.text();
    logger(`[fetch] incoming request: ${body}`);
    if (!body) {
      return new Response("Bad Request: No Input", { status: 400 });
    }

    let winner = await fetchRPCUrlWinner(env, logger);

    if (!winner) {
      winner = env.FALLBACK_ARB_RPC_URL;
    }

    //submit new POST request to the backend RPC winner
    let rawResponse;
    try {
      rawResponse = await fetch(winner, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
      });
      return buildResponse(env, logger, winner, rawResponse);
    } catch (e) {
      const msg = "Internal Server Error - [fetch] fetching response";
      console.error(msg, JSON.stringify(e));
      if (winner != env.FALLBACK_ARB_RPC_URL) {
        // await env.RPC_ERROR_LIST.put(winner, Date.now());
        return new Response(msg, { status: 500 });
      }
      else {
        return new Response("Internal Server Error - [fetch] fallback failure", { status: 500 });
      }
    }
  },
};
