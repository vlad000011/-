import { useEffect, useState, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, saveSession } from "./api";

type Listing={id:string;title:string;description:string;city:string;exchangeFor?:string;condition:string;owner:{id:string;name:string};category:{name:string};images:{url:string}[]};
type User={id:string;email:string;name:string;roles:string[]};
const token=()=>!!localStorage.getItem("accessToken");
function App(){
 const [user,setUser]=useState<User|null>(null);
 useEffect(()=>{if(token()) api.get("/me").then(r=>setUser({...r.data,roles:r.data.roles.map((x:any)=>x.role.name)})).catch(()=>{});},[]);
 const logout=async()=>{try{await api.post("/auth/logout",{refreshToken:localStorage.getItem("refreshToken")});}catch{} localStorage.clear();setUser(null);};
 return <><header><Link className="brand" to="/">SwapSpace<span> обмен вещами</span></Link><nav><Link to="/">Каталог</Link>{user&&<><Link to="/create">Разместить</Link><Link to="/favorites">Избранное</Link><Link to="/profile">Кабинет</Link>{user.roles.some(r=>["ADMIN","MODERATOR"].includes(r))&&<Link to="/moderation">Модерация</Link>}</>}{user?.roles.includes("ADMIN")&&<Link to="/admin">Администрирование</Link>}</nav><div className="auth">{user?<><span>{user.name}</span><button className="outline" onClick={logout}>Выйти</button></>:<><Link to="/login">Войти</Link><Link className="button small" to="/register">Регистрация</Link></>}</div></header><main><RoutesView user={user} setUser={setUser}/></main><footer>SwapSpace · Учебный проект · 2026</footer></>;
}
function RoutesView({user,setUser}:{user:User|null;setUser:(u:User|null)=>void}){
 const { pathname: path } = useLocation();
 if(path==="/login"||path==="/register")return <AuthPage mode={path==="/login"?"login":"register"} setUser={setUser}/>;
 if(path==="/create")return <ListingForm/>;
 if(path.startsWith("/listing/")){const id=decodeURIComponent(path.slice("/listing/".length).split("/")[0]);return <ListingPage id={id}/>;}
 if(path==="/favorites")return <Favorites/>;
 if(path==="/profile")return <Profile user={user}/>;
 if(path==="/moderation")return <Moderation/>;
 if(path==="/admin")return <Admin/>;
 return <Catalog/>;
}
function AuthPage({mode,setUser}:{mode:"login"|"register";setUser:(u:User)=>void}){
 const nav=useNavigate();const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);try{const {data}=await api.post(`/auth/${mode}`,Object.fromEntries(f));saveSession(data);setUser(data.user);nav("/");}catch(e:any){setError(e.response?.data?.error||"Не удалось выполнить запрос");}finally{setBusy(false);}}
 return <section className="auth-card"><p className="eyebrow">SWAPSPACE COMMUNITY</p><h1>{mode==="login"?"С возвращением":"Создать аккаунт"}</h1><p className="muted">{mode==="login"?"Войдите, чтобы продолжить обмениваться":"Присоединяйтесь к сообществу обмена вещами"}</p><form onSubmit={submit}>{mode==="register"&&<label>Имя<input name="name" required minLength={2} placeholder="Ваше имя"/></label>}<label>Email<input name="email" type="email" required placeholder="name@example.com"/></label><label>Пароль<input name="password" type="password" required minLength={mode==="register"?8:1} placeholder="••••••••"/></label>{error&&<p className="error">{error}</p>}<button disabled={busy}>{busy?"Подождите…":mode==="login"?"Войти":"Зарегистрироваться"}</button></form><p className="muted">{mode==="login"?"Нет аккаунта? ":"Уже зарегистрированы? "}<Link to={mode==="login"?"/register":"/login"}>{mode==="login"?"Регистрация":"Войти"}</Link></p></section>;
}
function Catalog(){
 const [items,setItems]=useState<Listing[]>([]);const [categories,setCategories]=useState<any[]>([]);const [q,setQ]=useState("");const [categoryId,setCategory]=useState("");const [page,setPage]=useState(1);const [pages,setPages]=useState(1);const [loading,setLoading]=useState(true);
 useEffect(()=>{api.get("/categories").then(r=>setCategories(r.data)).catch(()=>{});},[]);
 useEffect(()=>{setLoading(true);api.get("/listings",{params:{q,categoryId,page,limit:9}}).then(r=>{setItems(r.data.items);setPages(r.data.pages||1);}).catch(()=>setItems([])).finally(()=>setLoading(false));},[q,categoryId,page]);
 return <><section className="hero"><div><p className="eyebrow">ВЕЩИ ДОСТОЙНЫ ВТОРОЙ ЖИЗНИ</p><h1>Освободи место.<br/><em>Найди своё.</em></h1><p>Обменивайся вещами с людьми рядом. Меньше лишнего — больше полезного.</p><a href="#catalog" className="button">Найти вещь <span>↗</span></a></div><div className="hero-art"><div className="orb orb1">♻</div><div className="floating f1">📚</div><div className="floating f2">🎧</div><div className="floating f3">🪴</div><div className="hero-note">give · find · repeat</div></div></section><section id="catalog" className="catalog"><div className="section-heading"><div><p className="eyebrow">КАТАЛОГ СООБЩЕСТВА</p><h2>Ищем новое применение</h2></div><span className="muted">Объявления участников</span></div><div className="filters"><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Поиск по названию или описанию…"/><select value={categoryId} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">Все категории</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{loading?<p>Загружаем объявления…</p>:<div className="grid">{items.map(item=><ListingCard key={item.id} item={item}/>)}</div>}{!loading&&!items.length&&<div className="empty">Пока нет объявлений. Попробуйте изменить поиск.</div>}<div className="pagination"><button className="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>Назад</button><span>Страница {page} из {Math.max(1,pages)}</span><button className="outline" disabled={page>=pages} onClick={()=>setPage(page+1)}>Далее</button></div></section></>;
}
function ListingCard({item}:{item:Listing}){return <Link to={`/listing/${item.id}`} className="card"><div className="card-image">{item.images?.[0]?<img src={`http://localhost:3000${item.images[0].url}`}/>:<span>♻</span>}<small>{item.category?.name}</small></div><div className="card-body"><div className="card-meta">{item.city} · {item.condition==="NEW"?"Новое":item.condition==="LIKE_NEW"?"Как новое":"Хорошее"}</div><h3>{item.title}</h3><p>{item.description}</p><div className="card-bottom"><b>{item.exchangeFor?`Ищет: ${item.exchangeFor}`:"Готов отдать"}</b><span>↗</span></div></div></Link>}
function ListingPage({id}:{id:string}){
 const [item,setItem]=useState<Listing|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [isFavorite,setIsFavorite]=useState(false);
 const [reportOpen,setReportOpen]=useState(false);
 const [reportReason,setReportReason]=useState("");
 const [reportBusy,setReportBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  setItem(null);setError("");
  api.get(`/listings/${encodeURIComponent(id)}`).then(r=>{if(active)setItem(r.data);}).catch(e=>{if(active)setError(e.response?.data?.error||"Не удалось загрузить объявление");});
  if(localStorage.getItem("accessToken")){
   api.get("/favorites").then(r=>{if(active)setIsFavorite(r.data.some((x:any)=>x.listingId===id));}).catch(()=>{});
  }
  return ()=>{active=false;};
 },[id]);
 async function favorite(){
  if(!localStorage.getItem("accessToken")){setMessage("Чтобы добавить объявление в избранное, войдите в аккаунт.");return;}
  try{
   if(isFavorite){await api.delete(`/favorites/${encodeURIComponent(id)}`);setIsFavorite(false);setMessage("Объявление удалено из избранного.");}
   else{await api.post(`/favorites/${encodeURIComponent(id)}`);setIsFavorite(true);setMessage("Объявление добавлено в избранное.");}
  }catch(e:any){setMessage(e.response?.data?.error||"Не удалось изменить избранное. Попробуйте войти заново.");}
 }
 async function contact(){
  if(!localStorage.getItem("accessToken")){setMessage("Чтобы написать автору, войдите в аккаунт.");return;}
  try{const {data}=await api.post("/conversations",{recipientId:item!.owner.id});const body=prompt("Напишите первое сообщение:");if(body?.trim())await api.post(`/conversations/${data.id}/messages`,{body:body.trim()});setMessage(body?.trim()?"Сообщение отправлено.":"Диалог создан.");}
  catch(e:any){setMessage(e.response?.data?.error||"Не удалось создать диалог.");}
 }
 async function report(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!localStorage.getItem("accessToken")){setMessage("Чтобы отправить жалобу, войдите в аккаунт.");return;}
  const reason=reportReason.trim();
  if(reason.length<5){setMessage("Опишите причину жалобы (минимум 5 символов).");return;}
  setReportBusy(true);setMessage("");
  try{await api.post(`/listings/${encodeURIComponent(id)}/reports`,{reason});setMessage("Жалоба отправлена. Она появится в панели модерации.");setReportReason("");setReportOpen(false);}
  catch(e:any){setMessage(e.response?.data?.error||"Не удалось отправить жалобу.");}
  finally{setReportBusy(false);}
 }
 if(error)return <div className="empty">{error}<p><Link to="/">Вернуться в каталог</Link></p></div>;
 if(!item)return <p>Загрузка объявления…</p>;
 return <section className="detail">
  <Link to="/">← Назад в каталог</Link><p className="eyebrow">{item.category.name} · {item.city}</p><h1>{item.title}</h1>
  <div className="detail-panel"><div className="detail-image">{item.images?.[0]?<img src={`http://localhost:3000${item.images[0].url}`} alt={item.title}/>:<span>♻</span>}</div>
   <div><h2>Описание</h2><p>{item.description}</p><p><b>Состояние:</b> {item.condition}</p><p><b>Владелец:</b> {item.owner.name}</p><p><b>Интересует обмен на:</b> {item.exchangeFor||"Предложения открыты"}</p>
    <div className="actions"><button onClick={contact}>Написать автору</button><button className="outline" onClick={favorite}>{isFavorite?"Убрать из избранного":"В избранное"}</button><button className="text-button" onClick={()=>setReportOpen(v=>!v)}>Пожаловаться</button></div>
    {message&&<p className="success" role="status">{message}</p>}
    {reportOpen&&<form className="report-form" onSubmit={report}><label htmlFor="report-reason">Причина жалобы</label><textarea id="report-reason" value={reportReason} onChange={e=>setReportReason(e.target.value)} minLength={5} maxLength={500} required placeholder="Опишите, что нарушает правила сообщества…"/><small>{reportReason.length}/500 символов</small><div className="actions"><button type="submit" disabled={reportBusy}>{reportBusy?"Отправка…":"Отправить жалобу"}</button><button type="button" className="outline" onClick={()=>setReportOpen(false)}>Отмена</button></div></form>}
   </div>
  </div>
 </section>
}
function ListingForm(){const nav=useNavigate();const [error,setError]=useState("");const [cats,setCats]=useState<any[]>([]);useEffect(()=>{api.get("/categories").then(r=>setCats(r.data));},[]);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const data=Object.fromEntries(f);try{const res=await api.post("/listings",data);const file=(f.get("image") as File);if(file?.size){const fd=new FormData();fd.append("image",file);await api.post(`/listings/${res.data.id}/images`,fd);}nav(`/listing/${res.data.id}`);}catch(e:any){setError(e.response?.data?.error||"Проверьте поля и авторизацию");}}return <section className="form-card"><p className="eyebrow">НОВОЕ ОБЪЯВЛЕНИЕ</p><h1>Поделитесь вещью</h1><form onSubmit={submit}><label>Название<input name="title" required minLength={3}/></label><label>Описание<textarea name="description" required minLength={10}/></label><div className="two"><label>Категория<select name="categoryId" required><option value="">Выберите</option>{cats.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Город<input name="city" required defaultValue="Москва"/></label></div><div className="two"><label>Состояние<select name="condition"><option value="NEW">Новое</option><option value="LIKE_NEW">Как новое</option><option value="GOOD" selected>Хорошее</option><option value="FAIR">Есть следы использования</option></select></label><label>На что хотите обменять<input name="exchangeFor" placeholder="Например, настольная игра"/></label></div><label>Фотография (JPEG, PNG, WebP до 5 МБ)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label>{error&&<p className="error">{error}</p>}<button>Опубликовать</button></form></section>}
function Favorites(){
 const [items,setItems]=useState<any[]>([]);const [error,setError]=useState("");
 const load=()=>api.get("/favorites").then(r=>{setItems(r.data.map((x:any)=>x.listing));setError("");}).catch(e=>setError(e.response?.data?.error||"Не удалось загрузить избранное. Войдите в аккаунт."));
 useEffect(()=>{load();},[]);
 async function remove(id:string){try{await api.delete(`/favorites/${encodeURIComponent(id)}`);setItems(current=>current.filter(x=>x.id!==id));}catch(e:any){setError(e.response?.data?.error||"Не удалось удалить объявление из избранного.");}}
 return <section><h1>Избранное</h1>{error&&<p className="error" role="alert">{error}</p>}<div className="grid">{items.map(x=><div key={x.id}><ListingCard item={x}/><button className="outline small" onClick={()=>remove(x.id)}>Убрать из избранного</button></div>)}</div>{!items.length&&!error&&<p className="muted">Избранных объявлений пока нет.</p>}</section>
}
function Profile({user}:{user:User|null}){const [me,setMe]=useState<any>(null);const [mine,setMine]=useState<any[]>([]);const [dialogs,setDialogs]=useState<any[]>([]);useEffect(()=>{api.get("/me").then(r=>setMe(r.data)).catch(()=>{});api.get("/me/listings").then(r=>setMine(r.data)).catch(()=>{});api.get("/conversations").then(r=>setDialogs(r.data)).catch(()=>{});},[]);return <section><p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1>{me?.name||user?.name||"Профиль"}</h1><p>{me?.email}</p><h2>Мои объявления</h2><div className="grid">{mine.map(x=><ListingCard key={x.id} item={x}/>)}</div><h2>Диалоги</h2>{dialogs.map(d=><div className="list-row" key={d.id}>Диалог · {d.messages?.[0]?.body||"Нет сообщений"} <Link to={`/chat/${d.id}`}>Открыть</Link></div>)}{!dialogs.length&&<p className="muted">Диалогов пока нет.</p>}</section>}
function Moderation(){const [reports,setReports]=useState<any[]>([]);const [stats,setStats]=useState<any>({});const load=()=>{api.get("/moderation/reports").then(r=>setReports(r.data)).catch(()=>{});api.get("/admin/stats").then(r=>setStats(r.data)).catch(()=>{});};useEffect(load,[]);async function act(id:string,status:string){await api.patch(`/moderation/reports/${id}`,{status});load();}return <section><p className="eyebrow">ЦЕНТР МОДЕРАЦИИ</p><h1>Контроль сообщества</h1><div className="stats"><div><b>{stats.users||0}</b><span>Пользователей</span></div><div><b>{stats.listings||0}</b><span>Объявлений</span></div><div><b>{stats.openReports||0}</b><span>Открытых жалоб</span></div></div><h2>Жалобы</h2>{reports.map(r=><div className="list-row" key={r.id}><div><b>{r.listing.title}</b><p>{r.reason} · {r.status}</p></div><div><button className="small" onClick={()=>act(r.id,"REVIEWED")}>Рассмотрено</button><button className="outline small" onClick={()=>act(r.id,"REJECTED")}>Отклонить</button></div></div>)}{!reports.length&&<p className="muted">Новых жалоб нет.</p>}</section>}
function Admin(){const [users,setUsers]=useState<any[]>([]);const [logs,setLogs]=useState<any[]>([]);const load=()=>{api.get("/admin/users").then(r=>setUsers(r.data)).catch(()=>{});api.get("/admin/audit").then(r=>setLogs(r.data)).catch(()=>{});};useEffect(load,[]);async function block(id:string,isBlocked:boolean){await api.patch(`/admin/users/${id}`,{isBlocked:!isBlocked});load();}return <section><p className="eyebrow">ADMINISTRATION</p><h1>Администрирование</h1><h2>Пользователи</h2>{users.map(u=><div className="list-row" key={u.id}><span>{u.name} · {u.email} · {u.roles.map((x:any)=>x.role.name).join(", ")}</span><button className="outline small" onClick={()=>block(u.id,u.isBlocked)}>{u.isBlocked?"Разблокировать":"Заблокировать"}</button></div>)}<h2>Журнал аудита</h2>{logs.slice(0,30).map(l=><div className="list-row" key={l.id}><span>{l.action} · {l.user?.email||"система"}</span><small>{new Date(l.createdAt).toLocaleString()}</small></div>)}</section>}
export default App;
