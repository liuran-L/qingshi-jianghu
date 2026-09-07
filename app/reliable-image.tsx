'use client';
/* eslint-disable next/no-img-element -- 离线资源直接加载，不依赖图片优化服务。 */
import { useState } from 'react';
/** 地址改变即重建加载状态，旧图失败不会污染下一幅图。 */
export function ReliableImage(props: {src?:string;alt:string;className?:string;position?:string}) {
 return <ImageAttempt key={props.src ?? props.alt} {...props} />;
}
function ImageAttempt({src,alt,className,position}:{src?:string;alt:string;className?:string;position?:string}) {
 const [failed,setFailed]=useState(false);
 return src&&!failed?<img src={src} alt={alt} className={className} style={{objectPosition:position}} onError={()=>setFailed(true)} />:<span className={`${className ?? ''} image-fallback`} aria-label={alt}>{alt}<small>画卷暂缺，仍可继续阅读</small></span>;
}
