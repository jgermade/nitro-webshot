
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else {
        // Browser globals
        root.nitroWebshot = factory();
    }
}(this, function () {

  function http (url, options) {
    options = options || {};

    var request = new XMLHttpRequest(),
        on = { success: [], error: [] };

    request.onreadystatechange = function() {
      // console.log('readystatechanged', request.readyState, request.status);
      if(request.readyState === 4) {
        var response = {
              status: request.status,
              statusText: request.statusText,
              data: /application\/json/.test( request.getResponseHeader('Content-Type') ) ? JSON.parse(request.responseText) : request.responseText
            },
            listeners = ( request.status > 0 && request.status >= 200 && request.status <= 400 ) ? on.success : on.error;

        for( var i = 0, n = listeners.length ; i < n ; i++ ) {
          listeners[i](response);
        }
      }
    }

    request.open( options.method ? options.method.toUpperCase() : 'GET', url, true);

    if( options.contentType ) {
      request.setRequestHeader('Content-Type', options.contentType);
    }

    request.send( options.contentType === 'application/json' ? JSON.stringify(options.data) : options.data );

    request.done = function (listener) {
      if( typeof listener === 'function' ) {
        on.success.push(listener);
      }
      return request;
    };

    request.error = function (listener) {
      if( typeof listener === 'function' ) {
        on.error.push(listener);
      }
      return request;
    };

    return request;
  }

  function extend (dest, src) {
    for( var key in src ) {
      dest[key] = src[key];
    }
    return dest;
  }

  var webshot = {
    documentHTML: function () {
      [].forEach.call(document.querySelectorAll('input'), function (input) {
        if( input.value ) {
          input.setAttribute('webshot--value', input.value);
        }
      });
      var html = document.documentElement.outerHTML.replace(/<input([^>]*?) webshot--value="(.*?)"([^>]*?)>/g, function (matched, prev, value, post) {
        return '<input ' + prev + post + ' value="' + value + '">';
      });
      [].forEach.call(document.querySelectorAll('input[webshot--value]'), function (input) {
        input.removeAttribute('webshot--value');
      });

      return html;
    },
    parsedHTML: function (html) {
      var matchedBase = location.origin + '/',
          html = ( html || webshot.documentHTML() ).replace(/<base\s+href="(.*)"[^>]*\/?>/, function (_matched, base) {
            matchedBase = location.origin + base;
            return '';
          });

      return html.replace(/<head>/, '<head>\n<base href="' + matchedBase + '"/>\n');
    },
    render: function (options) {
      options = options || {};

      var data = extend(extend({
        height: window.innerHeight,
        width: window.innerWidth
      }, options), {
        html: options.html || webshot.parsedHTML(),
        userAgent: navigator.userAgent,
        origin: location.origin
      });

      return http('http://localhost:3000/api/render', {
        method: 'POST',
        contentType: 'application/json',
        data: data
      }).done(function (response) {
        console.group('rendered');
        console.log('http://localhost:3000' + response.data.htmlFile);
        console.log('http://localhost:3000' + response.data.phantom);
        console.log('http://localhost:3000' + response.data.slimer);
        console.log('response', response);
        console.groupEnd();
      }).error(function (response) {
        console.error(response);
      });
    },
    renderInline: function (options) {
      options = options || {};

      var html = webshot.documentHTML(),
          styles = [], i = 0;

      html = html.replace(/<link[^>]*href="(.*?)"[^>]*>/g, function (_matched, href) {

        if( !/\.css(\?|$)/.test(href) || ( /^https?:\/\//.test(href) && href.trim().indexOf(location.origin) < 0 ) ) {
          return _matched;
        }

        var n = i++;

        styles[n] = null;
        console.log('loading style', href );
        http( href ).done(function (response) {
          styles[n] = response.data.replace(/url\(["']?(\/.*?)["']?\)/g, function (matched, url) {
            return 'url(\'' + location.origin + url + '\')';
          });

          if( styles.every(function (style) { return style !== null; }) ) {

            webshot.render(extend(options, {
              html: webshot.parsedHTML( html.replace(/\$css{(.*?)}/g, function (matched, index) {
                return styles[Number(index)];
              }).replace(/<img(.*?)src="(\/.*?)"/g, function (matched, props, src) {
                return '<img' + props + 'src="' + location.origin + src + '"';
              }) )
            }));
          }
        });

        return '\n<style rel="stylesheet">\n$css{' + (styles.length - 1) + '}\n</style>\n';
      });

      if( !i ) {
        webshot.render(extend(options || {}, { html: webshot.parsedHTML(html) }));
      }

    }
  };

  return webshot;

}));
