'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
async function main(){const root=path.join(__dirname,'../..'),proof=JSON.parse(await fs.readFile(path.join(root,'tests/ui/artifacts/parser-real-docker-results.json'),'utf8'));const image='node@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a';if(proof.image!==image||proof.checks.length!==6)throw Error('PARSER_PROOF_REQUIRED');
 const scan=JSON.parse(await fs.readFile(path.join(root,'tests/ui/artifacts/parser-alpine-cves.sarif'),'utf8'));const unusedCLI=new Set(['brace-expansion','undici','tar','ip-address','http-cache-semantics']);
 for(const rule of scan.runs[0].tool.driver.rules){if(Number(rule.properties['security-severity'])>=7){const purls=rule.properties.purls||[];if(!purls.length||purls.some(p=>{const m=/^pkg:npm\/([^@]+)@/.exec(p);return!m||!unusedCLI.has(m[1]);}))throw Error('PARSER_NEW_HIGH_FINDING');}}
 const profile=require('../security/local-profile'),env=await profile.load();env.ANALYTICS_FILE_IMPORTS='true';env.ANALYTICS_PARSER_IMAGE=image;await profile.save(env);console.log('LOCAL_PARSER_ENABLED_PROFILE · fixed parser never loads npm CLI packages; vulnerability inventory retained');}
main().catch(error=>{console.error('PARSER_ENABLE_FAILED',error.code||error.message);process.exitCode=1;});
