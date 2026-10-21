import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePairingOffer, parseTransferReceipt } from '../src/core/pairing.ts';

const now=1_000_000;
const offer={protocol:'w2p-mobile-1',endpoint:'https://192.168.1.25:53515',certificateSha256:'a'.repeat(64),code:'b'.repeat(64),expiresAt:now+120000,desktopName:'我的电脑'};
test('pairing accepts a bounded private HTTPS offer and rejects identity ambiguity',()=>{
 assert.equal(parsePairingOffer(JSON.stringify(offer),now).desktopName,'我的电脑');
 for(const change of [{endpoint:'http://192.168.1.25:53515'},{endpoint:'https://example.com:53515'},{endpoint:'https://8.8.8.8:53515'},{endpoint:'https://192.168.1.25:53515/?token=x'},{certificateSha256:'wrong'},{expiresAt:now-1},{expiresAt:now+120001},{cookie:'secret'}])assert.throws(()=>parsePairingOffer(JSON.stringify({...offer,...change}),now));
});
test('transport receipts cannot announce conversion or Figma import and cannot exceed confirmed bytes',()=>{
 const value={uploadId:'a'.repeat(64),nextOffset:256,bytes:512,status:'receiving',converted:false,figmaImported:false};
 assert.equal(parseTransferReceipt(JSON.stringify(value),value.uploadId,512).nextOffset,256);
 for(const change of [{nextOffset:513},{status:'received'},{converted:true},{figmaImported:true},{bytes:1},{uploadId:'b'.repeat(64)}])assert.throws(()=>parseTransferReceipt(JSON.stringify({...value,...change}),value.uploadId,512));
});

test('Expo Go pairing accepts encrypted LAN offers but rejects changed hosts, weak keys and expired codes',()=>{
 const secure={...offer,protocol:'w2p-mobile-2',lan:{endpoint:'http://192.168.1.25:53516',key:'c'.repeat(64),id:'d'.repeat(32)}};
 assert.equal(parsePairingOffer(JSON.stringify(secure),now).protocol,'w2p-mobile-2');
 for(const lan of [{...secure.lan,endpoint:'http://8.8.8.8:53516'},{...secure.lan,endpoint:'http://192.168.1.26:53516'},
  {...secure.lan,key:'123456'},{...secure.lan,id:'wrong'},{...secure.lan,endpoint:'http://192.168.1.25:53516/path'},
  {...secure.lan,endpoint:'http://192.168.1.25:80'}])assert.throws(()=>parsePairingOffer(JSON.stringify({...secure,lan}),now));
 assert.throws(()=>parsePairingOffer('https://example.com',now),/不是电脑配对/);
});
