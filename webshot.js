
function uuid4 () {
  //// return uuid of form xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  var uuid = '', ii;
  for (ii = 0; ii < 32; ii += 1) {
    switch (ii) {
    case 8:
    case 20:
      uuid += '-';
      uuid += (Math.random() * 16 | 0).toString(16);
      break;
    case 12:
      uuid += '-';
      uuid += '4';
      break;
    case 16:
      uuid += '-';
      uuid += (Math.random() * 4 | 8).toString(16);
      break;
    default:
      uuid += (Math.random() * 16 | 0).toString(16);
    }
  }
  return uuid;
}

require('colors');

function runServer (port, hostname) {

  var express = require('express')
  var app = express()
  var bodyParser = require('body-parser')
  var fs = require('fs')

  app.use(bodyParser.json()); // for parsing application/json
  app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  // app.get('/', function (req, res) {
  //   res.send('Hello World!')
  // })

  app.use(express.static('public'))

  app.post('/render', function (req, res) {
    var html = req.body.html.replace(/'/g, '\\\'').replace(/\n/g, ''),
    resultFile = uuid4() + '/' + ( req.body.filename || 'page.png' ),
    // renderJS = 'render-this-html.js';
    renderScript = '/tmp/nitro-webshot/' + resultFile + '.js';

    var mkdirp = require('mkdirp');

    mkdirp( (function () {
      var parts = renderScript.split('/');
      parts.pop();
      return parts.join('/');
    })(), function (err) {
      if (err) {
        res.status(500).send('error creating tmp script');
        return;
      }

      fs.writeFileSync(renderScript , `
        var page = require('webpage').create();
        page.viewportSize = { width: ${ req.body.width || 1360 }, height: ${ req.body.height || 900 } };
        page.content = '${ html }';
        setTimeout(function() {
          page.render('public/renders/${resultFile}');
          phantom.exit();
        }, ${ req.body.wait || 10 });
        `, { encoding: 'utf8' });

        require('child_process').exec('$(npm bin)/phantomjs ' + renderScript, function (err) {
          if( !err ) {
            res.json({
              file: '/renders/' + resultFile
            });
            // res.send(resultFile);
          } else {
            res.status(500).send('error rendering!');
          }
        });
      });

    });

    port = port || 3000;
    hostname = hostname || '0.0.0.0';

    app.listen(3000, hostname, function () {
      var baseUrl = `http://${hostname}:${port}`;

      console.log('Listening on ' + baseUrl.green )

      console.log('\ncopy and paste following into your browser console:\n'.yellow)
      console.log(`(function (d) {
  var s=d.createElement('script');
  s.src='${baseUrl}/nitro-webshot.js';
  d.head.appendChild(s)
})(document);`)

      console.log('\nonce loaded execute following:\n'.yellow)

      console.log('var request = nitroWebshot.render();\n\n');

      fs.writeFileSync('public/index.html' ,
        '<p>copy and paste following into your browser console:</p>' +
        `<p><pre><code>(function (d) {
  var s=d.createElement('script');
  s.src='${baseUrl}/nitro-webshot.js';
  d.head.appendChild(s)
})(document);</code></pre></p>` +
        '<br/>' +
        '<p>once loaded execute following:</p>' +
        "<p><pre>var request = nitroWebshot.render();</pre></p>"
      , { encoding: 'utf8' });


    });
}

module.exports = {
  server: runServer
};


// window.checkoutHTML = function () {
//
//   // var html = document.documentElement.outerHTML,
//   //     styles = [];
//   //
//   // html = html.replace(/<link[^>]*href="(.*?)"/g, function (_matched, href) {
//   //   styles.push( fetch(href).then(function (response) { return response.text(); }) );
//   //   console.debug('loading style', href);
//   //   return '<style rel="stylkesheet">$css{' + (styles.length - 1) + '}</style>';
//   // });
//   //
//   // return Promise.all(styles).then(function (fetchedStyles) {
//   //   html = html.replace(/\$css{(.*?)}/g, function (matched, index) {
//   //     return fetchedStyles[Number(index)];
//   //   });
//   //
//   //   console.log('render html', html);
//   //   return html;
//   // });
//
//
//   var matchedBase = location.origin + '/',
//       html = document.documentElement.outerHTML.replace(/<base\s+href="(.*)"[^>]*\/?>/, function (_matched, base) {
//         matchedBase = location.origin + base;
//         return '';
//       });
//
//   return html.replace(/<head>/, '<head><base href="' + matchedBase + '"/>').replace(/\s*<script[^>]*>([\s\S]*?)<\/script>\s*/g, '');
//
// };
