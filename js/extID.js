const element = document.createElement('div')
element.innerHTML = chrome.runtime.id
element.id = 'background-color-post'
element.style.display = 'none'
document.documentElement.appendChild(element)
const script = document.createElement('script')
script.src = chrome.runtime.getURL('js/inject.js')
;(document.head || document.documentElement).appendChild(script)
