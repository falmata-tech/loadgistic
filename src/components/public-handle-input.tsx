'use client';

type HandleInputProps={id?:string;name?:string;defaultValue?:string;required?:boolean;disabled?:boolean;className?:string;placeholder?:string};

/** A handle is case-insensitive; the server repeats validation and uniqueness. */
export function PublicHandleInput(props:HandleInputProps){
 return <input {...props} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} pattern="[a-z0-9][a-z0-9_-]{1,63}" minLength={2} maxLength={64} onInput={event=>{
  const normalized=event.currentTarget.value.replace(/^@/,'').toLowerCase();
  if(event.currentTarget.value!==normalized)event.currentTarget.value=normalized;
 }}/>;
}
