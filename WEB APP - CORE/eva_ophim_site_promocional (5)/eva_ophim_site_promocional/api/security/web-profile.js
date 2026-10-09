'use strict';
const fs=require('node:fs/promises');
// A prepared local profile is the selected web environment on this Windows workstation.
// Production and the explicitly requested main profile always retain their own configuration.
async function select({requested=process.env.ASTHA_WEB_PROFILE,production=process.env.NODE_ENV==='production',platform=process.platform,local=require('./local-profile'),exists=async file=>{try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}}={}){
 if(requested!==undefined&&!['local','principal'].includes(requested))throw Error('WEB_PROFILE_INVALID');
 if(requested==='principal'||production){if(requested==='local'&&production)throw Error('LOCAL_PROFILE_NOT_PRODUCTION');return {name:'principal',env:{}};}
 if(platform!=='win32'){if(requested==='local')throw Error('WINDOWS_PROFILE_REQUIRED');return {name:'principal',env:{}};}
 if(!await exists(await local.profilePath())){if(requested==='local')throw Error('LOCAL_PROFILE_MISSING');return {name:'principal',env:{}};}
 // Decryption/validation errors are fatal; never fall back to a different database.
 return {name:'local',env:await local.load()};
}
module.exports={select};
