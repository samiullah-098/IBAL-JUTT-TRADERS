const express = require('express');
const cors = require('cors');
const { app } = require('./index');
const server = app.listen(5005, async () => {
  try {
    const res = await fetch('http://localhost:5005/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', type: 'BUYER' })
    });
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
