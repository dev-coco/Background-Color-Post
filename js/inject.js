const extensionID = document.getElementById('background-color-post').outerText

// 发送到后台
const sendBg = data => new Promise(resolve => chrome.runtime.sendMessage(extensionID, data, res => { resolve(res) }))

const content = document.querySelector('#content')
const tbody = document.querySelector('tbody')
const log = document.querySelector('#log')

/**
 * @description 自定义延迟时间
 * @param {number} num - 秒数
 */
const delay = num => new Promise(resolve => setTimeout(resolve, num * 1000))

// 随机生成 uuid
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, str => {
  const randomInt = (Math.random() * 16) | 0
  return (str === 'x' ? randomInt : (randomInt & 3) | 8).toString(16)
})

/**
 * @description 左下角信息通知
 * @param {string} text - 通知的文本
 */
function notify (text) {
  Toastify({
    text,
    duration: 2000,
    close: true,
    gravity: 'bottom',
    position: 'left',
    style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' }
  }).showToast()
}

/**
 * @description HTML转义
 * @param {string} str - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function htmlEscape (str) {
  str = str.replace(/&/g, '&amp;')
  str = str.replace(/"/g, '&quot;')
  str = str.replace(/</g, '&lt;')
  str = str.replace(/>/g, '&gt;')
  str = str.replace(/\n/g, '&#10;')
  return str
}

let myID, dtsgToken, blob, lang
// 初始化
async function init () {
  const mainEl = document.querySelectorAll('main')
  mainEl[0].style.display = 'none'
  mainEl[1].style.display = ''
  // 获取本地化字符串
  lang = await sendBg({ action: 'lang' })
  // 获取字符元素，写入对应语言的字符
  const elements = document.querySelectorAll('main:nth-child(2) [data-localize]')
  for (const el of elements) {
    el.innerText = lang[el.getAttribute('data-localize')]
  }
  try {
    // 获取用户 ID
    myID = await sendBg({ action: 'userID' })
  } catch {
    return notify(lang.loginFail)
  }
  // 获取 token
  dtsgToken = await sendBg({ action: 'getToken' })
  // 获取储存的小组信息
  tbody.innerHTML = await sendBg({ action: 'groupHTML' })
}
init()

/**
 * @description 上传图片
 * @param {string} link - 链接
 * @returns {string} 图片ID
 */
async function uploadImage (blob) {
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = () => {
      const base64data = reader.result
      resolve(base64data)
    }
  })

  return await sendBg({
    action: 'uploadImage',
    param: {
      myID,
      dtsgToken,
      base64,
      uuid: uuid()
    }
  })
}

// 选择图片
document.querySelector('.select-image').addEventListener('click', () => {
  document.getElementById('fileInput').click()
})

const dragArea = document.getElementById('dragArea')
const fileInput = document.getElementById('fileInput')
const preview = document.getElementById('preview')

// 拖动事件
dragArea.addEventListener('dragover', event => {
  event.preventDefault()
  dragArea.classList.add('hover')
})

dragArea.addEventListener('dragleave', () => {
  dragArea.classList.remove('hover')
})

dragArea.addEventListener('drop', event => {
  event.preventDefault()
  dragArea.classList.remove('hover')
  const file = event.dataTransfer.files[0]
  handleFile(file)
})

fileInput.addEventListener('change', event => {
  const file = event.target.files[0]
  handleFile(file)
})

// 处理文件
function handleFile (file) {
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = e => {
      blob = new Blob([new Uint8Array(e.target.result)], { type: file.type })
      preview.innerHTML = `<img src="${URL.createObjectURL(blob)}" class="img-fluid mt-3">`
    }
    reader.readAsArrayBuffer(file)
  } else {
    notify(lang.validImages)
  }
}

// 获取小组
document.getElementById('getGroup').addEventListener('click', async e => {
  // 禁用获取小组按钮
  e.target.disabled = true
  // 游标代码
  let cursor = ''
  let html = ''
  let index = 0
  notify(lang.gettingGroup)
  const variables = {
    count: 20,
    ordering: ['integrity_signals'],
    scale: 2
  }
  for (let i = 0; i < Infinity; i++) {
    if (cursor) variables.cursor = cursor
    const info = await sendBg({
      action: 'getGroups',
      param: {
        dtsgToken,
        variables,
        cursor
      }
    })
    for (const groupInfo of info.edges) {
      index++
      html += `<tr>
        <td><input type="checkbox" id="${groupInfo.node.id}"></td>
        <td><label for="${groupInfo.node.id}"><img src="${groupInfo.node.profile_picture.uri}"></label></td>
        <td><label for="${groupInfo.node.id}"><a href="${groupInfo.node.url}" target="_blank">${htmlEscape(groupInfo.node.name)}</a><label></td>
       </tr>`
    }
    notify(`${lang.retrieveGroup.replace('@', index)}`)
    // 没有下一页
    if (!info.page_info.has_next_page) break
    // 记录游标
    cursor = info.page_info.end_cursor
    await delay(1.5)
  }
  // 储存小组信息
  sendBg({
    action: 'saveHTML',
    param: { html }
  })
  // 加载到 table
  tbody.innerHTML = html
  // 隐藏按钮
  e.target.style.setProperty('display', 'none', 'important')
})

// 发布帖文
document.getElementById('sendPost').addEventListener('click', async e => {
  // 获取选中的小组
  const groups = [...document.querySelectorAll('td input:checked')].map(x => [x.id, x.parentNode.parentNode.outerText.trim()])
  // 获取已选中的彩色背景
  const selectedColor = document.querySelector('input[type="radio"]:checked')
  if (!content.value) return notify(lang.enterContent)
  if (!selectedColor) return notify(lang.selectBackground)
  // 禁用发布帖文按钮
  e.target.disabled = true
  // 清空记录
  log.innerHTML = ''
  // 请求参数
  const variables = {
    input: {
      composer_entry_point: 'inline_composer',
      logging: { composer_session_id: uuid() },
      source: 'WWW',
      message: {
        text: content.value
      },
      inline_activities: [],
      explicit_place_id: '0',
      text_format_preset_id: selectedColor.value,
      event_share_metadata: {},
      audience: {},
      actor_id: myID,
      client_mutation_id: '2'
    },
    feedbackSource: 0,
    scale: 2,
    privacySelectorRenderLocation: 'COMET_STREAM',
    checkPhotosToReelsUpsellEligibility: false,
    useDefaultActor: false,
    isFeed: false,
    isFundraiser: false,
    isFunFactPost: false,
    isEvent: false,
    isSocialLearning: false,
    isPageNewsFeed: false,
    isProfileReviews: false,
    isWorkSharedDraft: false,
    canUserManageOffers: false,
    __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: false,
    __relay_internal__pv__IncludeCommentWithAttachmentrelayprovider: true,
    __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
    __relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider: false,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
    __relay_internal__pv__IsMergQAPollsrelayprovider: false,
    __relay_internal__pv__StoriesArmadilloReplyEnabledrelayprovider: true,
    __relay_internal__pv__EventCometCardImage_prefetchEventImagerelayprovider: false
  }
  // 检测是否传入图片
  if (blob) {
    // 上传图片
    const photoID = await uploadImage(blob)
    // 添加图片参数
    variables.input.attachments = {
      photo: { id: photoID }
    }
  }
  if (groups.length > 0) {
    // 发到小组
    variables.input.composer_type = 'group'
    variables.input.composer_source_surface = 'group'
    let index = 0
    for (const groupInfo of groups) {
      // 解构赋值
      const [groupID, groupName] = groupInfo
      variables.input.audience.to_id = groupID
      notify(lang.posting)
      const json = await sendBg({
        action: 'postGroup',
        param: {
          dtsgToken,
          variables
        }
      })
      try {
        log.innerHTML += `<div>
          <strong class="bg-success-subtle py-1 px-2 rounded-3">${lang.success}</strong>
          <span>${groupName}</span>
          <br>
          <a href="${json.data.story_create.story.url}" target="_blank">${json.data.story_create.story.url}</a>
        </div>`
      } catch {
        log.innerHTML += `<div>
          <strong class="bg-danger-subtle py-1 px-2 rounded-3">${lang.fail}</strong>
          <span>${groupName}</span>
        </div>`
      }
      index++
      notify(`${lang.published} ${groups.length} / ${index}`)
      // 倒计时
      const randomNum = Math.floor(Math.random() * (60 - 45 + 1)) + 45
      for (let i = randomNum; i >= 0; i--) {
        // 如果最后一个发完就不在等待
        if (groups.length === index) break
        notify(lang.waiting.replace('@', i))
        await delay(1)
      }
    }
  } else {
    // 发到时间线
    variables.input.audience.to_id = myID
    variables.input.audience = {
      privacy: {
        allow: [],
        base_state: 'EVERYONE',
        deny: [],
        tag_expansion_state: 'UNSPECIFIED'
      }
    }
    variables.input.composer_source_surface = 'timeline'
    notify(lang.posting)
    const json = await sendBg({
      action: 'postTimeline',
      param: {
        dtsgToken,
        variables
      }
    })
    try {
      log.innerHTML += `<div>
        <strong class="bg-success-subtle py-1 px-2 rounded-3">${lang.success}</strong>
        <span>${lang.timeline}</span>
        <br>
        <a href="${json.data.story_create.story.url}" target="_blank">${json.data.story_create.story.url}</a>
      </div>`
    } catch {
      log.innerHTML += `<div>
        <strong class="bg-danger-subtle py-1 px-2 rounded-3">${lang.fail}</strong>
        <span>${lang.timeline}</span>
      </div>`
    }
    notify(lang.published)
  }
  e.target.disabled = false
})
