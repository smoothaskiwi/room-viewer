// Retained suites deliberately exercise the folded owner-use UI.
// Rental-first navigation and styling have their own browser suite.
import puppeteer from 'puppeteer-core';
const launch=puppeteer.launch.bind(puppeteer);
puppeteer.launch=async(...args)=>{const browser=await launch(...args),newPage=browser.newPage.bind(browser);browser.newPage=async(...args)=>{const page=await newPage(...args),goto=page.goto.bind(page);await page.evaluateOnNewDocument(()=>document.addEventListener('DOMContentLoaded',()=>{const owner=document.querySelector('#owner-use');if(owner)owner.open=true;}));page.goto=async(...args)=>{const response=await goto(...args);await page.evaluate(()=>{const owner=document.querySelector('#owner-use');if(owner)owner.open=true;});return response;};return page;};return browser;};
