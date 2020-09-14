import logger from '../util/logger'
import * as WebRTC from '../util/webrtc'
import { roundToFixed } from '../util/helpers'
import { assureDeviceId } from './deviceHelpers'
import { DeviceType } from './constants'
import { CallOptions, IVertoCanvasInfo, ICanvasInfo, ICanvasLayout, IConferenceInfo, ILayout, IVertoLayout } from './interfaces'

export const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
  logger.info('RTCService.getUserMedia', constraints)
  const { audio, video } = constraints
  if (!audio && !video) {
    return null
  }
  try {
    return await WebRTC.getUserMedia(constraints)
  } catch (error) {
    logger.error('getUserMedia error: ', error)
    throw error
  }
}

export const removeUnsupportedConstraints = (constraints: MediaTrackConstraints): void => {
  const supported = WebRTC.getSupportedConstraints()
  Object.keys(constraints).map(key => {
    if (!supported.hasOwnProperty(key) || constraints[key] === null || constraints[key] === undefined) {
      delete constraints[key]
    }
  })
}

export const getMediaConstraints = async (options: CallOptions): Promise<MediaStreamConstraints> => {
  let { audio = true, micId } = options
  const { micLabel = '' } = options
  if (micId) {
    micId = await assureDeviceId(micId, micLabel, DeviceType.AudioIn).catch(error => null)
    if (micId) {
      if (typeof audio === 'boolean') {
        audio = {}
      }
      audio.deviceId = { exact: micId }
    }
  }

  let { video = false, camId } = options
  const { camLabel = '' } = options
  if (camId) {
    camId = await assureDeviceId(camId, camLabel, DeviceType.Video).catch(error => null)
    if (camId) {
      if (typeof video === 'boolean') {
        video = {}
      }
      video.deviceId = { exact: camId }
    }
  }

  return { audio, video }
}

type DestructuredResult = { subscribed: string[], alreadySubscribed: string[], unauthorized: string[], unsubscribed: string[], notSubscribed: string[] }

export const destructSubscribeResponse = (response: any): DestructuredResult => {
  const tmp = {
    subscribed: [],
    alreadySubscribed: [],
    unauthorized: [],
    unsubscribed: [],
    notSubscribed: []
  }
  Object.keys(tmp).forEach(k => { tmp[k] = response[`${k}Channels`] || [] })
  return tmp
}

const _updateMediaStreamTracks = (stream: MediaStream, kind: string = null, enabled: boolean = null) => {
  if (!WebRTC.streamIsValid(stream)) {
    return null
  }
  const _updateTrack = (track: MediaStreamTrack) => {
    switch (enabled) {
      case true:
        track.enabled = true
        break
      case false:
        track.enabled = false
        break
      default:
        track.enabled = !track.enabled
        break
    }
  }
  switch (kind) {
    case 'audio':
      return stream.getAudioTracks().forEach(_updateTrack)
    case 'video':
      return stream.getVideoTracks().forEach(_updateTrack)
    default:
      return stream.getTracks().forEach(_updateTrack)
  }
}

export const enableAudioTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'audio', true)
export const disableAudioTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'audio', false)
export const toggleAudioTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'audio', null)
export const enableVideoTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'video', true)
export const disableVideoTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'video', false)
export const toggleVideoTracks = (stream: MediaStream) => _updateMediaStreamTracks(stream, 'video', null)

export const mutateCanvasInfoData = (canvasInfo: IVertoCanvasInfo): ICanvasInfo => {
  const { canvasID, layoutFloorID, scale, canvasLayouts, ...rest } = canvasInfo
  const layouts: ICanvasLayout[] = []
  let layoutOverlap = false
  for (let i = 0; i < canvasLayouts.length; i++) {
    const layout = canvasLayouts[i]
    const { memberID, audioPOS, xPOS, yPOS, ...rest } = layout
    layoutOverlap = layoutOverlap || layout.overlap === 1
    layouts.push({
      startX: `${roundToFixed((layout.x / scale) * 100)}%`,
      startY: `${roundToFixed((layout.y / scale) * 100)}%`,
      percentageWidth: `${roundToFixed((layout.scale / scale) * 100)}%`,
      percentageHeight: `${roundToFixed((layout.hscale / scale) * 100)}%`,
      participantId: String(memberID),
      audioPos: audioPOS,
      xPos: xPOS,
      yPos: yPOS,
      ...rest
    })
  }
  return {
    ...rest,
    canvasId: canvasID,
    layoutFloorId: layoutFloorID,
    scale,
    canvasLayouts: layouts,
    layoutOverlap,
  }
}

export const checkIsDirectCall = ({ variables }) => {
  return typeof variables === 'object' && 'verto_svar_direct_call' in variables
}

export const destructConferenceState = (confState: any): IConferenceInfo => {
  const { variables = {}, flags = {} } = confState
  const suffix = `${confState.md5}@${confState.domain}`
  return {
    uuid: confState.uuid,
    md5: confState.md5,
    domain: confState.domain,
    running: Boolean(confState.running),
    laChannel: `conference-liveArray.${suffix}`,
    infoChannel: `conference-info.${suffix}`,
    modChannel: `conference-mod.${suffix}`,
    confName: confState.name,
    numMembers: Number(confState.members) || 0,
    isPrivate: variables.is_private === 'true',
    mohPlaying: Boolean(confState.mohPlaying),
    filesPlaying: Boolean(confState.filesPlaying),
    filesPlayingName: confState.filesPlayingName || null,
    asyncFilesPlaying: Boolean(confState.asyncFilesPlaying),
    asyncFilesPlayingName: confState.asyncFilesPlayingName || null,
    asyncFilesPlayingPaused: Boolean(confState.asyncFilesPlayingPaused),
    asyncFilesPlayingVolume: Number(confState.asyncFilesPlayingVolume) || null,
    filesSeekable: Boolean(confState.filesSeekable),
    asyncFilesSeekable: Boolean(confState.asyncFilesSeekable),
    performerDelay: confState.performerDelay,
    volAudience: confState['vol-audience'],
    filesFullScreen: Boolean(confState.filesFullScreen),
    // flags
    silentMode: flags['silent-mode'] || false,
    meetingMode: flags['meeting-mode'] || false,
    vidMuteHide: flags['vid-mute-hide'] || false,
    personalCanvas: Boolean(flags.personalCanvas),
    personalCanvasTP: flags.personalCanvasTP || null,
    locked: Boolean(flags.locked),
    recording: Boolean(flags.recording),
    liveMusic: Boolean(flags.liveMusic),
    // variables
    publicClipeeze: variables.public_clipeeze === 'true',
    confQuality: variables.conf_quality,
    accessPin: variables.access_pin || null,
    moderatorPin: variables.moderator_pin || null,
    speakerHighlight: variables.speaker_highlight === 'true',
    disableIntercom: variables.disable_intercom === true,
    lastLayoutGroup: variables.lastLayoutGroup,
    lastLayout: variables.lastLayout,
  }
}


const _layoutReducer = (result: ILayout[], layout: IVertoLayout) => {
  const { type, name, displayName, resIDS = [] } = layout
  const label = displayName || name.replace(/[-_]/g, ' ')
  return result.concat({ id: name, label, type, reservationIds: resIDS, belongsToAGroup: false })
}

function _layoutCompare(prev: ILayout, next: ILayout) {
  const prevLabel = prev.label.toLowerCase()
  const nextLabel = next.label.toLowerCase()
  if (prevLabel > nextLabel) {
    return 1
  } else if (prevLabel < nextLabel) {
    return -1
  }
  return 0
}

export const mungeLayoutList = (layouts: IVertoLayout[], layoutGroups: IVertoLayout[]) => {
  const layoutsPartOfGroup = layoutGroups.reduce((cumulative, layout) => {
    return cumulative.concat(layout.groupLayouts || [])
  }, [])

  const normalList = layouts.reduce(_layoutReducer, [])
  normalList.forEach((layout) => {
    layout.belongsToAGroup = layoutsPartOfGroup.includes(layout.id)
  })
  const groupList = layoutGroups.reduce(_layoutReducer, [])
  return groupList.concat(normalList).sort(_layoutCompare)
}
