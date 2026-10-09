'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const ALLOWED=new Set(['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL_REQUIRED','JWT_SECRET','PORT','HOST','NODE_ENV','ALLOWED_ORIGINS','GOOGLE_CLIENT_ID','ANALYTICS_TRUSTED_RUNNER','ANALYTICS_FILE_IMPORTS','ANALYTICS_PARSER_IMAGE']);
function validate(env){
 if(!env||Object.keys(env).some(k=>!ALLOWED.has(k))||Object.values(env).some(v=>typeof v!=='string'))throw Error('LOCAL_PROFILE_INVALID');
 if(env.GOOGLE_CLIENT_ID!==undefined&&!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID))throw Error('LOCAL_PROFILE_INVALID');
 if(env.DB_HOST!=='127.0.0.1'||env.DB_PORT!=='3306'||env.DB_NAME!=='astha_raven_lab'||env.DB_USER!=='astha_lab_web'||env.HOST!=='127.0.0.1'||env.NODE_ENV!=='development'||!['3000','3001'].includes(env.PORT)||env.DB_SSL_REQUIRED!=='false'||!env.DB_PASSWORD||typeof env.JWT_SECRET!=='string'||env.JWT_SECRET.length<48)throw Error('LOCAL_PROFILE_INVALID');
 return env;
}
let knownDirectory;
async function discoverDirectory(){
 // Ask Windows for the current user's known folder, not a terminal override.
 if(!knownDirectory)knownDirectory=powershell("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); [Console]::Write([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData))").catch(error=>{knownDirectory=undefined;throw error;});
 return knownDirectory;
}
const workspaceProfilePath=()=>path.resolve(__dirname,'..','.local','local-web.dpapi');
async function fileExists(file){try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function profilePath({platform=process.platform,discover=discoverDirectory,exists=fileExists,workspace=workspaceProfilePath()}={}){
 if(platform!=='win32')throw Error('WINDOWS_PROFILE_REQUIRED');
 const directory=await discover();
 if(typeof directory!=='string'||!path.win32.isAbsolute(directory)||directory.startsWith('\\\\')||directory.includes('\0'))throw Error('LOCAL_PROFILE_DIRECTORY_UNAVAILABLE');
 const userFile=path.win32.join(directory,'ASTHA-RAVEN','local-web.dpapi');
 // Only a missing location can select the installation's copy of the same
 // DPAPI profile. A decryption or validation failure never tries another file.
 if(!await exists(userFile)&&await exists(workspace))return workspace;
 return userFile;
}
function powershell(command,input){return new Promise((resolve,reject)=>{
 const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const child=spawn(exe,['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,shell:false,stdio:['pipe','pipe','ignore']});let output='',done=false;
 const timer=setTimeout(()=>finish(Error('LOCAL_PROFILE_TIMEOUT')),15000);
 function finish(error){if(done)return;done=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve(output.trim());}
 child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>16384)finish(Error('LOCAL_PROFILE_OUTPUT_LIMIT'));});child.on('error',()=>finish(Error('LOCAL_PROFILE_UNAVAILABLE')));child.stdin.on('error',()=>finish(Error('LOCAL_PROFILE_UNAVAILABLE')));child.on('close',code=>finish(code===0?null:Error('LOCAL_PROFILE_UNAVAILABLE')));child.stdin.end(input);
});}
const PREAMBLE="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; ";
async function writeProtected(file,encrypted){
 const directory=path.dirname(file);await fs.mkdir(directory,{recursive:true});
 await powershell("$ErrorActionPreference='Stop'; $p=[Console]::In.ReadToEnd(); $acl=[IO.Directory]::GetAccessControl($p,[Security.AccessControl.AccessControlSections]::Access); $acl.SetAccessRuleProtection($true,$false); foreach($existing in @($acl.Access)){$acl.RemoveAccessRuleSpecific($existing)}; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule); [IO.Directory]::SetAccessControl($p,$acl)",directory).catch(()=>{throw Error('LOCAL_PROFILE_ACL_FAILED');});
 await fs.writeFile(file,encrypted,{encoding:'ascii',mode:0o600});
}
async function save(env){
 validate(env);const file=await profilePath();
 const encrypted=await powershell(PREAMBLE+"$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))",JSON.stringify(env)).catch(()=>{throw Error('LOCAL_PROFILE_ENCRYPT_FAILED');});
 await writeProtected(file,encrypted);
 if(file!==workspaceProfilePath())await writeProtected(workspaceProfilePath(),encrypted);
 return file;
}
async function installWorkspaceCopy(){
 await load(); // Verify the current user's decryption and safe lab configuration first.
 const source=await profilePath(),target=workspaceProfilePath();
 if(source!==target)await writeProtected(target,await fs.readFile(source,'ascii'));
 return target;
}
async function load(){const encrypted=await fs.readFile(await profilePath(),'ascii');const plain=await powershell(PREAMBLE+"$b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))",encrypted);return validate(JSON.parse(plain));}
module.exports={validate,save,load,profilePath,installWorkspaceCopy};
