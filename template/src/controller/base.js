const request = require('../middleware/proxy/request')
var requestPromise = require('request-promise')
var merge = require('../utils/assist').merge

const METHOD_TYPES = {
  json: [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report'
  ],
  form: [
    'application/x-www-form-urlencoded',
  ],
  text: [
    'text/plain',
    'text/xml'
  ]
}

module.exports = class extends think.Controller {
  
  /**
   * 获取原始请求header
   */
  getRequestHeader() {
    let { headers, method } = this.ctx.request
    let headersCopy = merge({}, headers)
    // console.log(headersCopy)
    // 由于字段参数发生改变，content-length不再可信删除content-length字段
    delete headersCopy['content-length']
    // 干掉请求中的if-modified-since字段，以防命中服务端缓存，返回304
    delete headersCopy['if-modified-since']

    // 配置host，先把当前用户host存入user-host,然后把请求host赋值给headers
    headersCopy['user-host'] = headersCopy.host

    delete headersCopy['host']

    return {
      headers: headersCopy,
      method,
    }
  }

  getRequestPayload() {
    let result = {}
    if (this.ctx.request.is(METHOD_TYPES.json)) {
      result.json = this.ctx.request.body.post
    } else if (this.ctx.request.is(METHOD_TYPES.form)) {
      result.form = this.ctx.request.body
    } else if (this.ctx.request.is(METHOD_TYPES.text)) {
      result.body = this.ctx.request.body
    }
    return result
  }

  /**
   * 转发并包装请求 
   * @param {*} options {uri,method,headers} 具体参数参见 https://www.npmjs.com/package/request
   */
  proxy(options, config) {
    let origionRequestHeader = this.getRequestHeader()

    let origionRequestPayLoad = this.getRequestPayload()
    let requestOption = merge({}, origionRequestHeader, origionRequestPayLoad, options, {
      gzip: false,
      encoding: null
    })

    think.logger.debug('请求头\n', requestOption)

    return request(this.ctx, requestOption, {
      callBack: (response, data) => {
        think.logger.debug('后台response\n', data)
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
            response.body = data
          } catch (err) { }
        }
        return response
      },
      needPipeRes: true,
    })
  }

  /**
   * 获取远端数据，options参数同 request-promise https://www.npmjs.com/package/request-promise
   * @param {Object} options 
   */
  selfFetch(options) {
    think.logger.debug('请求头\n', options)
    return requestPromise(options).then(res => {
      think.logger.debug('后台response\n', res)
      let response = null
      try {
        response = JSON.parse(res)
      } catch (e) {
      }
      finally {
        return response || res
      }
    })
  }
}
