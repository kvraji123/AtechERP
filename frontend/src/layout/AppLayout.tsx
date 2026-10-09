import{useEffect,useState}from"react";
import{Outlet,useLocation}from"react-router-dom";
import{AppFeedbackProvider}from"../components/AppFeedback";
import Sidebar from"./Sidebar";
import Topbar from"./Topbar";
export default function AppLayout(){
    const[open,setOpen]=useState(false);
    const location=useLocation();
    useEffect(()=>{
        if(!location.pathname.startsWith("/marketing/"))return;
        const preventNumberArrowChange=(event:KeyboardEvent)=>{
            if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;
            const target=event.target;
            if(target instanceof HTMLInputElement&&target.type==="number"&&!target.disabled&&!target.readOnly)event.preventDefault();
        };
        document.addEventListener("keydown",preventNumberArrowChange,true);
        return()=>document.removeEventListener("keydown",preventNumberArrowChange,true);
    },[location.pathname]);
    return <AppFeedbackProvider><div className="app-shell"><Sidebar mobileOpen={open} onClose={()=>setOpen(false)}/><main className="app-main-area"><Topbar onMenuClick={()=>setOpen(true)}/><div className="app-content"><Outlet/></div></main></div></AppFeedbackProvider>}
