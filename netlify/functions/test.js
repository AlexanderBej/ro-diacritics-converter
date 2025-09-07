exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: "Netlify functions are working!" })
  };
};