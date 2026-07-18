const ws = new WebSocket('ws://localhost:9420/ws');
let got = 0;
ws.on('open', () => {
  ws.send(JSON.stringify({ type:'hello', sessionId:'probe-'+Date.now(), role:'frontend' }));
  ws.send(JSON.stringify({ type:'dev:subscribe' }));
  // Trigger some events via interpret
  setTimeout(() => fetch('http://localhost:9420/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'list providers'})}).catch(()=>{}), 300);
  setTimeout(() => fetch('http://localhost:9420/api/health/providers').catch(()=>{}), 600);
});
ws.on('message', (d) => {
  let m; try { m = JSON.parse(d.toString()); } catch { return; }
  if (m.type === 'dev:subscribed') { console.log('ACK dev:subscribed'); return; }
  got++;
  if (got <= 12) console.log('EVENT', m.type, JSON.stringify(m).slice(0,90));
});
setTimeout(() => { console.log('TOTAL EVENTS RECEIVED:', got); ws.close(); process.exit(0); }, 4000);
