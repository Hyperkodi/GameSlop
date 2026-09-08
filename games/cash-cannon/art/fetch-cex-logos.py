"""Collect original logo icons referenced by the exchanges' official websites."""
import concurrent.futures, json, requests
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
ROOT=Path(__file__).resolve().parent
SITES={name:'https://'+host for name,host in [
 ('binance','www.binance.com/en'),('mexc','www.mexc.com'),('kraken','www.kraken.com'),
 ('coinbase','www.coinbase.com'),('okx','www.okx.com'),('bybit','www.bybit.com'),
 ('kucoin','www.kucoin.com'),('gate','www.gate.com'),('bitget','www.bitget.com'),
 ('crypto-com','crypto.com'),('gemini','www.gemini.com'),('bitfinex','www.bitfinex.com')]}
class Icons(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='link' and 'icon' in a.get('rel','').lower():self.links.append(a)
def discover(item):
 name,url=item
 try:
  r=requests.get(url,timeout=25);p=Icons();p.feed(r.text)
  return {'id':name,'site':url,'status':r.status_code,'icons':[{**a,'href':urljoin(r.url,a.get('href',''))} for a in p.links]}
 except Exception as e:return {'id':name,'error':str(e)}
if __name__=='__main__':
 rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(discover,SITES.items()))
 (ROOT/'cex-discovery.json').write_text(json.dumps(rows,indent=2))
 print(json.dumps(rows,indent=2))
