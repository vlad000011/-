import axios from "axios";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api" });
api.interceptors.request.use(config => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r=>r, async error=>{
  const original=error.config;
  if(error.response?.status===401 && !original._retry && localStorage.getItem("refreshToken") && !original.url?.includes("/auth/refresh")){
    original._retry=true;
    try{
      const {data}=await axios.post(`${api.defaults.baseURL}/auth/refresh`,{refreshToken:localStorage.getItem("refreshToken")});
      localStorage.setItem("accessToken",data.accessToken); localStorage.setItem("refreshToken",data.refreshToken);
      original.headers.Authorization=`Bearer ${data.accessToken}`; return api(original);
    }catch{localStorage.clear();}
  }
  return Promise.reject(error);
});
export function saveSession(data:any){localStorage.setItem("accessToken",data.accessToken);localStorage.setItem("refreshToken",data.refreshToken);}
