
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
    parsedHTML: function (html) {
      var matchedBase = location.origin + '/',
          html = (html || document.documentElement.outerHTML).replace(/<base\s+href="(.*)"[^>]*\/?>/, function (_matched, base) {
            matchedBase = location.origin + base;
            return '';
          });

      return html.replace(/<head>/, '<head>\n<base href="' + matchedBase + '"/>\n').replace(/\s*<script[^>]*>([\s\S]*?)<\/script>\s*/g, '');
    },
    render: function (options) {
      options = options || {};

      return http('http://localhost:3000/render', {
        method: 'POST',
        contentType: 'application/json',
        data: extend(options, {
          html: options.html || webshot.parsedHTML(),
          height: window.innerHeight,
          width: window.innerWidth
        })
      }).done(function (response) {
        console.log(response);
        console.log('http://localhost:3000' + response.data.file);
        console.log('http://localhost:3000' + response.data.htmlFile);
      }).error(function (response) {
        console.error(response);
      });
    },
    renderInline: function (options) {
      options = options || {};

      var html = document.documentElement.outerHTML,
          styles = [], i = 0;

      html = html.replace(/<link[^>]*href="(.*?)"[^>]*>/g, function (_matched, href) {

        if( !/\.css(\?|$)/.test(href) ) {
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
