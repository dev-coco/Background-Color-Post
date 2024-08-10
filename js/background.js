chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.i18n.getMessage('tutorial') })
  }
})

chrome.action.onClicked.addListener(function (tab) {
  chrome.tabs.create({
    url: 'https://dev-coco.github.io/Extension/Background-Color-Post/'
  })
})

// 函数列表
const functionMap = {
  lang: async () => {
    const obj = {}
    const langCode = chrome.i18n.getMessage('lang')
    const json = await fetch(`/_locales/${langCode}/messages.json`).then(response => response.json())
    for (const [key, value] of Object.entries(json)) {
      obj[key] = value.message
    }
    return obj
  },
  base64ToBlob: base64 => {
    // 查找 MIME 类型的起始位置
    const mimeTypeMatch = base64.match(/^data:(.+);base64,/)
    // 提取 MIME 类型
    const mimeType = mimeTypeMatch[1]
    // 去除 MIME 类型前缀
    const base64Data = base64.replace(/^data:.+;base64,/, '')
    // 解码 Base64 字符串
    const byteCharacters = atob(base64Data)
    // 创建一个 Uint8Array 来存储字节数据
    const byteArrays = []
    // 将每个字符的字节数据存储到 Uint8Array 中
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)
      const byteNumbers = new Array(slice.length)
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }
    // 创建 Blob 对象
    const blob = new Blob(byteArrays, { type: mimeType })
    return blob
  },
  userID: async () => {
    const cookies = await chrome.cookies.getAll({ domain: 'facebook.com', name: 'c_user' })
    return cookies[0]?.value || ''
  },
  getToken: async () => {
    return await fetch('https://m.facebook.com/ajax/dtsg/?__a=true')
      .then(response => response.text())
      .then(text => JSON.parse(text.replace('for (;;);', '')).payload.token)
  },
  groupHTML: async () => {
    const config = await new Promise((resolve) => chrome.storage.local.get(null, resolve))
    return config.groupHTML || ''
  },
  saveHTML: async param => {
    await new Promise((resolve) => chrome.storage.local.set({ groupHTML: param.html }, resolve))
    return 'HTML saved successfully'
  },
  uploadImage: async param => {
    const obj = {
      av: param.myID,
      __user: param.myID,
      __a: 1,
      fb_dtsg: param.dtsgToken
    }
    const body = new FormData()
    body.append('file', functionMap.base64ToBlob(param.base64))
    body.append('upload_id', param.uuid)
    const json = await fetch(`https://www.facebook.com/life_event/composer/upload/?${new URLSearchParams(obj).toString()}`, {
      body,
      method: 'POST'
    })
      .then(response => response.text())
      .then(text => JSON.parse(text.replace('for (;;);', '')))
    return json.payload.photoID
  },
  getGroups: async param => {
    const body = new FormData()
    body.append('fb_dtsg', param.dtsgToken)
    body.append('fb_api_req_friendly_name', 'GroupsCometAllJoinedGroupsSectionPaginationQuery')
    body.append('variables', JSON.stringify(param.variables))
    body.append('doc_id', '6009728632468556')
    const json = await fetch('https://www.facebook.com/api/graphql/', {
      body,
      method: 'POST',
      credentials: 'include'
    }).then(response => response.json())
    const info = json.data.viewer.all_joined_groups.tab_groups_list
    return info
  },
  postGroup: async param => {
    const body = new FormData()
    body.append('fb_dtsg', param.dtsgToken)
    body.append('fb_api_req_friendly_name', 'ComposerStoryCreateMutation')
    body.append('variables', JSON.stringify(param.variables))
    body.append('doc_id', '9132198736792632')
    const text = await fetch('https://www.facebook.com/api/graphql/', {
      body,
      method: 'POST'
    }).then(response => response.text())
    const json = JSON.parse(text.split('\n')[0])
    return json
  },
  postTimeline: async param => {
    const body = new FormData()
    body.append('fb_dtsg', param.dtsgToken)
    body.append('fb_api_req_friendly_name', 'ComposerStoryCreateMutation')
    body.append('variables', JSON.stringify(param.variables))
    body.append('doc_id', '9132198736792632')
    const json = await fetch('https://www.facebook.com/api/graphql/', {
      body,
      method: 'POST'
    }).then(response => response.json())
    return json
  },
  fetchData: async (url, options) => {
    try {
      const response = await fetch(url, options)
      return await response.text()
    } catch (error) {
      return error.message
    }
  }
}

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  const { action, param } = message
  try {
    const result = await functionMap[action](param)
    sendResponse(result)
  } catch (error) {
    sendResponse(error.message)
  }
  return true
})
