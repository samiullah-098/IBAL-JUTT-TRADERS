const f = async () => { 
  const r = await fetch('https://iqbal-jutt-traders.netlify.app/api/debug', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({name: 'Test'}) 
  }); 
  console.log(r.status, await r.text()); 
}; 
f();
