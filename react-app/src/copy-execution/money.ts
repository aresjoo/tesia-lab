/** API18 money stays USDT; exact cent rounding is display-only, never a request. */
export function formatUsdt(language:string,value:string|null|undefined){
 if(value===null||value===undefined||! /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))return '—'
 const negative=value.startsWith('-'),[whole,fraction='']=(negative?value.slice(1):value).split('.')
 let cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));if(Number((fraction+'000')[2])>=5)cents++
 const integer=new Intl.NumberFormat(language,{maximumFractionDigits:0}).format(cents/100n)
 const decimal=new Intl.NumberFormat(language).formatToParts(1.1).find(part=>part.type==='decimal')?.value??'.'
 return`${negative&&cents?'−':''}${integer}${decimal}${(cents%100n).toString().padStart(2,'0')} USDT`
}
export function adjustAllocation(current:string,amount:string,out:boolean){
 if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(current)||!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount))return null
 const [c,cf='']=current.split('.'),[a,af='']=amount.split('.'),scale=Math.max(cf.length,af.length)
 if(BigInt(a+af.padEnd(scale,'0'))===0n)return null
 const value=BigInt(c+cf.padEnd(scale,'0'))+(out?-1n:1n)*BigInt(a+af.padEnd(scale,'0'))
 if(value<=0n)return null
 if(!scale)return value.toString()
 const raw=value.toString().padStart(scale+1,'0');return(raw.slice(0,-scale)+'.'+raw.slice(-scale)).replace(/0+$/,'').replace(/\.$/,'')
}
