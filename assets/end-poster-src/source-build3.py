import asyncio, os, random
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(D,"out3"); os.makedirs(OUT,exist_ok=True)
FONTS="""
@font-face{font-family:Anton;src:url(anton.woff2)}
@font-face{font-family:PJS;font-weight:500;src:url(pjs-500.woff2)}
@font-face{font-family:PJS;font-weight:600;src:url(pjs-600.woff2)}
@font-face{font-family:PJS;font-weight:800;src:url(pjs-800.woff2)}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;position:relative;font-family:PJS}
"""
GOLD="#C9A24A"
def badge(scale):
    s=lambda v:int(v*scale)
    return f'''<div style="position:absolute;top:0;right:0;background:{GOLD};color:#0B0B0D;
      padding:{s(30)}px {s(44)}px {s(26)}px {s(40)}px;border-bottom-left-radius:{s(40)}px;
      box-shadow:0 8px 28px rgba(0,0,0,.4);text-align:center">
      <div style="font:800 {s(20)}px/1 PJS;letter-spacing:{s(5)}px;opacity:.75;margin-bottom:{s(10)}px">COMMENT</div>
      <div style="font:800 {s(64)}px/1 PJS;letter-spacing:{s(4)}px">RAIL</div></div>'''
def post(scale):
    return f'<html><head><style>{FONTS}</style></head><body><img src="overlay-none.jpg" style="position:absolute;inset:0;width:1080px;height:1350px">{badge(scale)}</body></html>'
random.seed(7)
qr="".join(f'<i style="background:{"#111" if random.random()<.5 else "#fff"}"></i>' for _ in range(21*21))
def generic_poster():
    return f'''<html><head><style>{FONTS}
    .qr{{display:grid;grid-template-columns:repeat(21,1fr);width:120px;height:120px}}</style></head><body>
    <img src="poster-sample.jpg" style="position:absolute;inset:0;width:1080px;height:1350px">
    <div style="position:absolute;left:0;right:0;top:1150px;bottom:0;background:#fff"></div>
    <div style="position:absolute;left:100px;top:1158px;width:360px">
      <div style="font:400 60px/1.05 Anton;color:#13223F">Your Name</div>
      <div style="font:500 28px/1.3 PJS;color:#4A5568;margin-top:4px">Your Company Real Estate</div>
      <div style="font:600 21px PJS;color:#E3161E;margin-top:2px">Shared via Dubilook: @yourhandle</div></div>
    <div style="position:absolute;left:480px;top:1160px;text-align:center"><div class="qr">{qr}</div>
      <div style="font:500 18px PJS;color:#718096;margin-top:4px">Save contact</div></div>
    <div style="position:absolute;right:100px;top:1172px;text-align:right;font:500 32px/1.75 PJS;color:#13223F">
      +971 50 000 0000<br><span style="font-size:27px">you@yourcompany.ae</span></div>
    </body></html>'''
L=dict(bg="#F6F4EF",fg="#0B0B0D",sub="#55555C",ac="#E3161E")
def final():
    return f'''<html><head><style>{FONTS}</style></head><body style="background:{L["bg"]}">
    <div style="position:absolute;inset:0;padding:60px 60px">
      <div style="text-align:center"><img src="logo-light-bg.png" style="height:54px"></div>
      <div style="font:400 88px/1.0 Anton;color:{L["fg"]};text-align:center;margin-top:30px;text-transform:uppercase">Publish this news<br>under your name</div>
      <div style="font:400 88px/1.0 Anton;color:{L["ac"]};text-align:center;margin:6px 0 30px;text-transform:uppercase">Comment it.</div>
      <div style="position:relative;width:540px;height:675px;margin:0 auto">
        <img src="out3/poster-generic.jpg" style="width:100%;height:100%;border-radius:22px;box-shadow:0 26px 60px rgba(0,0,0,.25)">
        <div style="position:absolute;left:-14px;right:-14px;top:584px;height:98px;border:5px dashed {L["ac"]};border-radius:22px"></div>
        <div style="position:absolute;right:-24px;top:500px;background:{L["ac"]};color:#fff;font:800 25px PJS;padding:9px 18px;border-radius:14px;transform:rotate(-2deg)">YOUR NAME &amp; NUMBER</div>
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:34px;font:800 29px PJS;color:{L["fg"]};white-space:nowrap">
        <span>① Find the word</span><span style="color:{L["sub"]}">→</span><span>② Comment it</span><span style="color:{L["sub"]}">→</span><span>③ Get it with your name</span></div>
      <div style="position:absolute;left:0;right:0;bottom:48px;text-align:center;font:600 28px PJS;color:{L["sub"]}">
        Works on every post · Follow <b style="color:{L["fg"]}">@dubilook</b></div>
    </div></body></html>'''
async def shot(page,html,name):
    fn=os.path.join(D,"_t.html"); open(fn,"w").write(html)
    await page.goto("file://"+fn); await page.wait_for_timeout(250)
    await page.screenshot(path=os.path.join(OUT,name),type="jpeg",quality=90)
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); page=await b.new_page(viewport={"width":1080,"height":1350})
        await shot(page,post(0.80),"B5-gold-80pct.jpg")
        await shot(page,post(0.68),"B5-gold-68pct.jpg")
        await shot(page,generic_poster(),"poster-generic.jpg")
        await shot(page,final(),"P2L-final.jpg")
        await b.close()
asyncio.run(main())
