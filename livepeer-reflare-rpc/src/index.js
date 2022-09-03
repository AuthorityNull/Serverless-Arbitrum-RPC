//const useReflare =require('livepeer-rpcflare');
import useReflare from 'livepeer-rpcflare';

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env)
    } catch (e) {
      return new Response(e.message)
    }
  },
}
async function handleRequest(request, env) {
  console.log("[hanleRequest] UPSTREAM CONFIG ",env.INIT_UPSTREAM_CONFIG)
  let upstream_config = JSON.parse(env.INIT_UPSTREAM_CONFIG);
  
  upstream_config.upstream.forEach(cfg => {
    cfg.pathRewrite = (path) => {
      console.log(`${cfg.domain} path = `, path);
      console.log(`${cfg.domain} new path = ${cfg.path}`);

      return cfg.path;
    };
  })
  console.log('[handleRequest] upstream_config = ', upstream_config);

  const reflare = await useReflare();

  reflare.push({
    path: '/*',
    loadBalancing: {
      policy: 'random',
    },
    upstream: upstream_config.upstream,
  });
  console.log('request = ', request.url);

  return reflare.handle(request);
}
