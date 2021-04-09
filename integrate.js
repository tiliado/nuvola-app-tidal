/*
 * Copyright 2018 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // var log = window ? window.console.log.bind(window.console) : null
  const C_ = Nuvola.Translate.pgettext
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction
  const PLAYER = 'div[data-test="footer-player"]'
  const ACTION_LIKE = 'like'

  const player = Nuvola.$object(Nuvola.MediaPlayer)
  const WebApp = Nuvola.$WebApp()

  WebApp._onInitAppRunner = function (emitter) {
    Nuvola.WebApp._onInitAppRunner.call(this, emitter)
    Nuvola.actions.addAction('playback', 'win', ACTION_LIKE, C_('Action', 'Like song'),
      null, null, null, false)
  }

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    player.addExtraActions([ACTION_LIKE])
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    const elms = this._getElements()
    const track = {
      title: Nuvola.queryText(PLAYER + ' div[data-test="footer-track-title"]'),
      artist: Nuvola.queryText(PLAYER + ' a[data-test="grid-item-detail-text-title-artist"]'),
      album: Nuvola.queryText(PLAYER + ' > div > div:last-child > div:nth-child(3) a'),
      artLocation: Nuvola.queryAttribute(PLAYER + ' figure[data-test="current-media-imagery"] img', 'src'),
      length: elms.timeTotal
    }

    let state
    if (elms.pause) {
      state = PlaybackState.PLAYING
    } else if (elms.play) {
      state = PlaybackState.PAUSED
    } else {
      state = PlaybackState.UNKNOWN
    }

    player.setPlaybackState(state)
    player.setTrack(track)
    player.setCanGoPrev(elms.prev)
    player.setCanGoNext(elms.next)
    player.setCanPlay(elms.play)
    player.setCanPause(elms.pause)

    player.setTrackPosition(elms.timeElapsed)
    player.setCanSeek(state !== PlaybackState.UNKNOWN && elms.progressbar)

    player.setCanChangeVolume(false)

    const repeat = this._getRepeat()
    player.setCanRepeat(repeat !== null)
    player.setRepeatState(repeat)

    const shuffle = this._getShuffle()
    player.setCanShuffle(shuffle !== null)
    player.setShuffleState(shuffle)

    Nuvola.actions.updateEnabledFlag(ACTION_LIKE, !!elms.like)
    Nuvola.actions.updateState(ACTION_LIKE, elms.like && elms.like.getAttribute('aria-checked') === 'true')

    setTimeout(this.update.bind(this), 500)
  }

  WebApp._onActionActivated = function (emitter, name, param) {
    const elms = this._getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        } else {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(elms.play)
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        Nuvola.clickOnElement(elms.pause)
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(elms.prev)
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(elms.next)
        break
      case PlayerAction.REPEAT:
        this._setRepeat(param)
        break
      case PlayerAction.SHUFFLE:
        Nuvola.clickOnElement(elms.shuffle)
        break
      case PlayerAction.SEEK: {
        const total = Nuvola.parseTimeUsec(elms.timeTotal)
        if (param > 0 && param <= total) {
          Nuvola.clickOnElement(elms.progressbar, param / total, 0.5)
        }
        break
      }
      case ACTION_LIKE:
        Nuvola.clickOnElement(elms.like)
        break
    }
  }

  WebApp._getElements = function () {
    // Interesting elements
    const elms = {
      play: document.querySelector(PLAYER + ' button[data-test="play"]'),
      pause: document.querySelector(PLAYER + ' button[data-test="pause"]'),
      next: document.querySelector(PLAYER + ' button[data-test="next"]'),
      prev: document.querySelector(PLAYER + ' button[data-test="previous"]'),
      repeat: document.querySelector('button[data-test="repeat"]'),
      shuffle: document.querySelector('button[data-test="shuffle"]'),
      like: document.querySelector('button[data-test="footer-favorite-button"]'),
      progressbar: document.querySelector(PLAYER + ' div[data-test="interaction-layer"]'),
      timeTotal: Nuvola.queryText(PLAYER + ' time.duration-time'),
      timeElapsed: Nuvola.queryText(PLAYER + ' time.current-time')
    }

    // Ignore disabled buttons
    for (const key in elms) {
      if (elms[key] && elms[key].disabled) {
        elms[key] = null
      }
    }
    return elms
  }

  WebApp._getRepeat = function () {
    const elm = this._getElements().repeat
    if (!elm) {
      return null
    }
    const type = elm.getAttribute('data-type')
    if (type === 'button__repeatSingle') {
      return Nuvola.PlayerRepeat.TRACK
    }
    return type === 'button__repeatAll' ? Nuvola.PlayerRepeat.PLAYLIST : Nuvola.PlayerRepeat.NONE
  }

  WebApp._setRepeat = function (repeat) {
    while (this._getRepeat() !== repeat) {
      Nuvola.clickOnElement(this._getElements().repeat)
    }
  }

  WebApp._getShuffle = function () {
    const elm = this._getElements().shuffle
    return elm ? elm.getAttribute('aria-checked') === 'true' : null
  }

  WebApp.start()
})(this) // function(Nuvola)
