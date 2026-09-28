"use client";

import { useEffect, useRef, useState, lazy, Suspense, Component, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowUpRight, ArrowRight, Pause, Play, MapPin, X, Check, Mail, Smartphone, Leaf, ChevronRight, Heart, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { RsvpForm } from "@/components/rsvp-form";
import { assetUrl, invitationUrl } from "@/lib/site";
import { invitation as wedding, chapters, storyPages, type MotionState } from "@/lib/invitation";

const GardenScene = lazy(() => import("../components/garden-scene"));
class SceneBoundary extends Component<{children: ReactNode}, {failed:boolean}> {
 state = {failed:false};
 static getDerivedStateFromError() { return {failed:true}; }
 render() { return this.state.failed ? null : this.props.children; }
}

type ModelContext = { registerTool: (tool: {name:string; title:string; description:string; inputSchema:object; annotations:object; execute:(input:unknown)=>unknown}, options:{signal:AbortSignal})=>void|Promise<void> };

export default function Home() {
 const motion = useRef<MotionState>({progress:0,book:0,ring:0,page:0,paused:false,reduced:false,tiltX:0,tiltY:0});
 const [mounted,setMounted] = useState(false);
 const [active,setActive] = useState(0);
 const [page,setPage] = useState(0);
 const [turning,setTurning] = useState(false);
 const [paused,setPaused] = useState(false);
 const [reduced,setReduced] = useState(false);
 const [tilt,setTilt] = useState(false);
 const [notice,setNotice] = useState("");
 const turnTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
 const root = useRef<HTMLElement>(null);

 useEffect(()=>{
   setMounted(true);
   gsap.registerPlugin(ScrollTrigger);
   const media = window.matchMedia("(prefers-reduced-motion: reduce)");
   const update = () => { motion.current.reduced = media.matches; setReduced(media.matches); };
   update(); media.addEventListener("change",update);
   const context = gsap.context(()=>{
     gsap.to(motion.current,{progress:1,ease:"none",scrollTrigger:{trigger:root.current,start:"top top",end:"bottom bottom",scrub:.7}});
     gsap.to(motion.current,{book:1,ease:"none",scrollTrigger:{trigger:"#story",start:"top 80%",end:"bottom 20%",scrub:.65}});
     gsap.to(motion.current,{ring:1,ease:"none",scrollTrigger:{trigger:"#union",start:"top 85%",end:"bottom 20%",scrub:.8}});
     for (let i=0;i<chapters.length;i++) ScrollTrigger.create({trigger:`#${chapters[i].id}`,start:"top 50%",end:"bottom 50%",onEnter:()=>setActive(i),onEnterBack:()=>setActive(i)});
     if(!media.matches) gsap.from(".hero-content > *",{y:20,opacity:0,duration:1.7,stagger:.16,ease:"power2.out",delay:.15});
   },root);
   const refresh = () => ScrollTrigger.refresh();
   document.fonts.ready.then(refresh);
   const contextApi = (document as Document & {modelContext?: ModelContext}).modelContext;
   const lifecycle = new AbortController();
   if(contextApi?.registerTool) {
     const register = (tool:Parameters<ModelContext["registerTool"]>[0]) => { try { Promise.resolve(contextApi.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch {} };
     register({name:"read_wedding_details",title:"Read wedding details",description:"Read the wedding date, venue, ceremony times and dress code.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>wedding});
     register({name:"open_invitation_chapter",title:"Open an invitation chapter",description:"Navigate to a chapter or the RSVP form. This does not submit a response.",inputSchema:{type:"object",properties:{chapter:{type:"string",enum:[...chapters.map(c=>c.id),"rsvp"]}},required:["chapter"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{
       const id = (input as {chapter?:string})?.chapter;
       if(!id || ![...chapters.map(c=>c.id),"rsvp"].includes(id)) throw new Error("Unknown chapter");
       document.getElementById(id)?.scrollIntoView({behavior:"instant"}); return {opened:id};
     }});
   }
   return ()=>{context.revert();media.removeEventListener("change",update);lifecycle.abort();if(turnTimer.current)clearTimeout(turnTimer.current)};
 },[]);

 useEffect(()=>{motion.current.paused=paused;},[paused]);
 useEffect(()=>{
   if(!tilt)return;
   const orient=(e:DeviceOrientationEvent)=>{if(e.gamma==null||e.beta==null)return;motion.current.tiltX=Math.max(-.5,Math.min(.5,e.gamma/60));motion.current.tiltY=Math.max(-.5,Math.min(.5,(e.beta-45)/90));};
   window.addEventListener("deviceorientation",orient);
   return ()=>{window.removeEventListener("deviceorientation",orient);motion.current.tiltX=0;motion.current.tiltY=0};
 },[tilt]);
 const enableTilt=async()=>{
   if(tilt){setTilt(false);return;}
   const sensor=window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
   if(!sensor){setNotice("Tilt is not available on this device.");return;}
   try{if(sensor.requestPermission && await sensor.requestPermission()!=="granted"){setNotice("Tilt permission was not granted. You can still explore by scrolling.");return;}setTilt(true);setNotice("Tilt enabled. Gently move your phone to explore.");}catch{setNotice("Tilt is not available. You can still explore by scrolling.");}
 };
 const turnPage=()=>{if(turning)return;const next=(page+1)%storyPages.length;setTurning(true);setPage(next);motion.current.page=next;turnTimer.current=setTimeout(()=>setTurning(false),1400)};
 const shareText = `Kavindu & Methmi — A Tale of Love, Heritage & Forever. Join us on 28 November 2027 at Shangri-La Colombo. Poruwa: 9:41 AM · Reception: 6:30 PM.`;
 const siteUrl = invitationUrl();
 const whatsAppShare = `https://wa.me/?text=${encodeURIComponent(shareText+" "+siteUrl)}`;

 return <main className="invitation" ref={root}>
   <div className="garden-backdrop" aria-hidden="true"/>
   <div className="scene-layer" aria-hidden="true">{mounted&&<SceneBoundary><Suspense fallback={null}><GardenScene motion={motion}/></Suspense></SceneBoundary>}</div>
   <a className="skip-link" href="#celebration">Skip to wedding details</a>
   <header className="site-header"><a href="#overture" className="monogram" aria-label="Kavindu and Methmi, back to the beginning">K<span>&</span>M</a><nav aria-label="Invitation"><a href="#story">Our story</a><a href="#celebration">The celebration</a></nav><a href="#rsvp" className="outline-link">Kindly RSVP <ArrowUpRight size={15}/></a></header>
   <nav className="chapter-nav" aria-label="Chapters">{chapters.map((chapter,index)=><a href={`#${chapter.id}`} key={chapter.id} aria-current={active===index?"step":undefined} aria-label={chapter.label}><span className="nav-number">0{index+1}</span><span className="nav-line"/><span className="nav-label">{chapter.label}</span></a>)}</nav>
   <div className="motion-controls"><button onClick={()=>setPaused(!paused)} aria-label={paused?"Resume garden animation":"Pause garden animation"} title={paused?"Resume animation":"Pause animation"}>{paused?<Play size={14}/>:<Pause size={14}/>}<span>{paused?"Motion paused":"Motion on"}</span></button><button className="tilt-button" onClick={enableTilt} aria-pressed={tilt} disabled={reduced}><Smartphone size={15}/><span>{tilt?"Tilt on":"Enable tilt"}</span></button></div>
   {notice&&<div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice("")}><X size={15}/></button></div>}
   <section id="overture" className="hero chapter">
     <div className="hero-content"><p className="eyebrow">TOGETHER WITH OUR FAMILIES</p><h1>Kavindu <em>&</em> Methmi</h1><p className="tagline">{wedding.tagline}</p><div className="gold-divider"/><p className="date-line">28 NOVEMBER 2027 <span>·</span> COLOMBO, SRI LANKA</p><a className="begin" href="#story">Enter our story <span><ArrowDown size={16}/></span></a></div>
     <div className="hero-foot"><span>A NEW CHAPTER BEGINS</span><span>SCROLL TO UNFOLD THE MAGIC</span><span>01 / 04</span></div>
   </section>
   <section id="story" className="chapter story-chapter">
     <div className="story-copy"><p className="eyebrow">CHAPTER I · OUR STORY</p><div className="page-copy" key={page}><span className="story-kicker">{storyPages[page].eyebrow}</span><h2>{storyPages[page].title.split("\n").map((line,i)=><span key={line}>{i===1?<em>{line}</em>:line}<br/></span>)}</h2><p className="body-copy">{storyPages[page].copy}</p></div><button className="text-button" onClick={turnPage} disabled={turning}>{page===2?"Begin the story again":"Turn the page"}{page===2?<RotateCcw size={17}/>:<ArrowRight size={19}/>}</button><div className="page-count"><span>0{page+1}</span><span className="fine-line"/><span>03</span></div></div>
     <figure className="story-portrait"><img src={assetUrl("couple-illustration.webp")} width="680" height="1020" alt="An illustration of a Sri Lankan couple in traditional wedding attire beneath a moonlit floral Poruwa arch" loading="lazy"/><figcaption>A little glimpse of our forever · Wedding illustration</figcaption></figure>
     <div className="story-foot"><span>A LOVE ROOTED IN TRADITION</span><a href="#union">The promise <ArrowDown size={15}/></a></div>
   </section>
   <section id="union" className="chapter union-chapter"><div className="union-heading"><p className="eyebrow">CHAPTER II · THE PROMISE</p><h2>Two hearts.<br/><em>One forever.</em></h2></div><div className="union-copy"><p>Together with their families,</p><h3>Kavindu Jayawardena <em>&</em><br/>Methmi Wickramasinghe</h3><p>invite you to celebrate their union.</p><span className="tiny-star">✦</span></div></section>
   <section id="celebration" className="chapter celebration-chapter"><div className="celebration-intro"><p className="eyebrow">CHAPTER III · THE CELEBRATION</p><h2>A day to remember.<br/><em>A lifetime to cherish.</em></h2><p className="body-copy">Your presence would make our beginning all the more beautiful.</p></div><div className="details-panel"><div className="date-block"><p className="eyebrow">SUNDAY</p><span className="day">28</span><span className="month">November 2027</span></div><div className="times-block"><div><span className="detail-label">THE PORUWA CEREMONY</span><p>9:41 <em>AM</em></p><span>With the blessings of our families</span></div><div><span className="detail-label">THE RECEPTION</span><p>6:30 <em>PM</em></p><span>An evening of love & celebration</span></div></div><div className="venue-block"><MapPin size={22}/><h3>Shangri-La<br/><em>Colombo</em></h3><p>The Grand Ballroom</p><address>{wedding.address}</address><Dialog><DialogTrigger asChild><button className="text-button">Find your way <ArrowUpRight size={17}/></button></DialogTrigger><DialogContent className="map-dialog"><DialogTitle className="map-title">Meet us at Shangri-La</DialogTitle><DialogDescription>{wedding.address}</DialogDescription><iframe title="Map of Shangri-La Colombo" src="https://maps.google.com/maps?q=Shangri-La+Hotel+Colombo&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><a href={wedding.mapsUrl} target="_blank" rel="noopener noreferrer" className="gold-button">Open in Google Maps <ArrowUpRight size={17}/></a></DialogContent></Dialog></div><div className="dress-code"><Leaf size={16}/><span><strong>DRESS CODE</strong> {wedding.dressCode}</span></div></div>
   </section>
   <section id="rsvp" className="rsvp-section"><div className="rsvp-heading"><p className="eyebrow">THE FINAL TOUCH IS YOU</p><h2>Be part of<br/><em>our forever.</em></h2><p>We look forward to celebrating<br/>this beautiful chapter with you.</p><div className="contact-links"><a href={`https://wa.me/${wedding.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer">A question? Message us <ArrowUpRight size={16}/></a><a href={`mailto:${wedding.email}`}>Send us an email <Mail size={15}/></a></div></div><div className="rsvp-panel"><RsvpForm/></div></section>
   <footer><a href="#overture" className="footer-monogram">K <em>&</em> M</a><p>With love, always.</p><div className="share-links"><span>SHARE THE INVITATION</span><a href={whatsAppShare} target="_blank" rel="noopener noreferrer">WhatsApp <ArrowUpRight size={13}/></a><a href={`mailto:?subject=${encodeURIComponent("You’re invited · Kavindu & Methmi")}&body=${encodeURIComponent(shareText+"\n\n"+siteUrl)}`}>Email <Mail size={13}/></a></div><div className="footer-bottom"><span>KAVINDU & METHMI · 28.11.2027</span><a href="#overture">Back to the beginning <ChevronRight size={13}/></a></div></footer>
 </main>;
}
