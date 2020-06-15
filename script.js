// 扩展 BGM，作者 Handle，部分参考 rin93 的源码
if (!!view && !!uiscript) {
  const musicDir = 'qqhlddz/'

  // 正负得点播放不同 音效
  const _showBackup = uiscript.UI_GameEnd.prototype.show
  uiscript.UI_GameEnd.prototype.show = function () {
    var musicPlayerFlag = false
    view.DesktopMgr.Inst.gameEndResult.players.forEach((player, index) => {
      if (player.seat == view.DesktopMgr.Inst.seat) {
        if (player.total_point >= 0) {
          setTimeout(() => {
            view.AudioMgr.PlaySound('audio/' + musicDir + 'win', 1)
          }, 3000)
          musicPlayerFlag = true
        } else {
          setTimeout(() => {
            view.AudioMgr.PlaySound('audio/' + musicDir + 'lose', 1)
          }, 3000)
          musicPlayerFlag = true
        }
      }
    })
    if (!musicPlayerFlag) {
      setTimeout(() => {
        view.AudioMgr.PlaySound('audio/' + musicDir + 'win', 1)
      }, 3000)
    }
    _showBackup.apply(this, arguments)
  }

  // 不同 UI 注入不同音乐
  const lobbyMusic = musicDir + 'lobby.mp3'
  const executeUIs = [['UI_Lobby', 'onEnable', 'lobby.mp3']]
  executeUIs.forEach(([scriptKey, funName, fileName]) => {
    uiscript[scriptKey].prototype[funName] = (() => {
      const functionBackup = uiscript[scriptKey].prototype[funName]
      return function () {
        view.AudioMgr.PlayMusic(musicDir + fileName, 1, false, true)
        return functionBackup.apply(this, arguments)
      }
    })()
  })

  let isRefreshPaiLeftHacked = false
  let isFastrecord = false
  let currentBGM
  let thisTurnBGM
  let richedCount = 0
  let fewPai = false
  const richMusicSet = { count: 0, file: '' }

  // 对默认音乐进行拒绝
  view.AudioMgr.PlayMusic = (() => {
    const functionBackup = view.AudioMgr.PlayMusic
    let lastTimeMusic = ''
    return function (audioDir, ...args) {
      // if (audioDir != 'music/game.mp3' && !isFastrecord) {
      // console.log(args)
      // console.warn('Playing: ' + audioDir)
      if (args[2] !== true) {
        if (view.BgmListMgr.bgm_lobby_list.includes(audioDir)) {
          lastTimeMusic = lobbyMusic
        }
        return functionBackup.apply(this, [lastTimeMusic, ...args])
      } else {
        lastTimeMusic = audioDir
      }
      return functionBackup.apply(this, [audioDir, ...args])
      // }
      // return null
    }
  })()

  // view.AudioMgr.StopMusic = (() => {
  //   var funBackup = view.AudioMgr.StopMusic
  //   return function() {
  //     return (
  //       !new Error().stack.split('\n')[3].match(/anonymous/) &&
  //       funBackup.apply(this, arguments)
  //     )
  //   }
  // })()
  const backupStopmusic = view.AudioMgr.StopMusic
  view.AudioMgr.StopMusic = function () {
    // console.warn(this)
    return backupStopmusic.apply(this, arguments)
  }

  const paiRemain = (number) => {
    return false
    // return view.DesktopMgr.Inst.left_tile_count <= number
  }
  const playMusic = () => {
    let fileDir = ''
    if (richedCount > 0) {
      // 立直
      if (richMusicSet.count < richedCount) {
        richMusicSet.count = richedCount
        fileDir = (() => {
          if (richedCount >= 2) {
            richedCount = 2
          }
          let richFile = 'Exciting' + richedCount
          return richFile
        })()
        richMusicSet.file = fileDir
      } else {
        fileDir = richMusicSet.file
      }
    } else if (paiRemain(20)) {
      if (!fewPai) {
        // 余牌少于 20
        fileDir =
          'few' +
          (() => {
            return (Math.random() * 5) >> 0
          })()
        fewPai = fileDir
      } else {
        fileDir = fewPai
      }
    }
    if (!fileDir) {
      currentBGM = thisTurnBGM
    } else {
      currentBGM = fileDir
    }
    currentBGM = `${musicDir}${currentBGM}.mp3`
    if (!isFastrecord && currentBGM && view.DesktopMgr.Inst.gameing) {
      view.AudioMgr.PlayMusic(currentBGM, 0, false, true)
    }
  }
  const newRound = (roundInfo) => {
    // 如果是第一局，hack剩余牌数
    if (!isRefreshPaiLeftHacked && view.DesktopMgr.Inst) {
      isRefreshPaiLeftHacked = true

      const functionBackup = view.DesktopMgr.Inst.RefreshPaiLeft
      view.DesktopMgr.Inst.RefreshPaiLeft = function (...args) {
        if (paiRemain(20)) {
          playMusic()
        }
        return functionBackup.apply(this, args)
      }
    }

    // roundInfo.ju为局数，roundInfo.ben为本场数
    thisTurnBGM = 'Normal'
    richedCount = 0
    fewPai = false
    richMusicSet.count = 0
    richMusicSet.file = ''
    playMusic()
  }

  view.ViewPlayer.prototype.AddQiPai = (function () {
    const functionBackup = view.ViewPlayer.prototype.AddQiPai
    return function (r, isRich, y, z) {
      if (isRich) {
        richedCount++
        // if (this.container_qipai.player.seat === view.DesktopMgr.Inst.seat) {
        //   isMyRich |= true
        // } else {
        //   isMyRich |= false
        // }
        playMusic()
      }
      return functionBackup.apply(this, arguments)
    }
  })()
  ;['play', 'fastplay', 'record', 'fastrecord'].forEach((key) => {
    const functionBackup = view.ActionNewRound[key]
    view.ActionNewRound[key] = function (...args) {
      isFastrecord = false
      if (key === 'fastrecord') {
        isFastrecord = true
      }
      const resultBackup = functionBackup.apply(this, args)
      newRound(...args)
      return resultBackup
    }
  })

  Object.entries({
    Replay: '_refreshBarshow',
    Live_Broadcast: '_fastSync',
  }).forEach(([key, value]) => {
    uiscript['UI_' + key]['prototype'][value] = (() => {
      const oldFunction = uiscript['UI_' + key]['prototype'][value]
      return function () {
        const resultBackup = oldFunction.apply(this, arguments)
        if (isFastrecord) {
          isFastrecord = false
          playMusic()
        }
        return resultBackup
      }
    })()
  })

  // 强制干翻立直BGM，作者Handle
  const backupFun = view.DesktopMgr.prototype.initRoom
  view.DesktopMgr.prototype.initRoom = function (...args) {
    // console.log(args)
    try {
      const player_datas = args[1]
      if (Array.isArray(player_datas)) {
        player_datas.forEach((player_data) => {
          const views = player_data.views
          if (views && views.length) {
            if (Array.isArray(views)) {
              player_data.views = views.filter((view) => {
                const slot = view.slot
                const id = view.item_id
                return !(slot == game.EView.lizhi_bgm)
              })
            }
          }
        })
      }
      args[1] = player_datas
    } catch (e) {
      console.warn(e)
    }
    return backupFun.call(this, ...args)
  }
}
