fetch('http://localhost:20128/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-b91deb1155cc05ec-6gdu74-53364211'
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o-mini',
    messages: [{role: 'user', content: 'test'}]
  })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
