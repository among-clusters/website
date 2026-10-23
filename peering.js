// Among Clusters hero: the Sovereign Cluster Peering flow, step by step. The Hub only
// relays hashes, digests and advertisements; service traffic goes gateway to gateway.
(function () {
  var root = document.querySelector('[data-peering]');
  if (!root) return;
  var copy = JSON.parse(document.getElementById('site-copy').textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var svg = root.querySelector('svg');
  var stepsHost = root.querySelector('[data-peering-steps]');
  var caption = root.querySelector('[data-peering-caption]');
  var pane = root.querySelector('[data-peering-pane]');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(parent, x, y, value, cls, anchor) {
    var node = el('text', { x: x, y: y, class: cls, 'text-anchor': anchor || 'middle' }, parent);
    node.textContent = value;
    return node;
  }
  function box(parent, x, y, w, h, title, sub) {
    var group = el('g', {}, parent);
    var rect = el('rect', { x: x, y: y, width: w, height: h, rx: 8, class: 'svg-box' }, group);
    text(group, x + w / 2, y + (sub ? 18 : 24), title, 'svg-title');
    if (sub) text(group, x + w / 2, y + 32, sub, 'svg-mono');
    return rect;
  }

  // Trust domains
  el('rect', { x: 12, y: 132, width: 250, height: 228, rx: 12, class: 'svg-zone' }, svg);
  el('rect', { x: 338, y: 132, width: 250, height: 228, rx: 12, class: 'svg-zone' }, svg);
  text(svg, 28, 154, copy.clusterA, 'svg-label', 'start');
  text(svg, 572, 154, copy.clusterB, 'svg-label', 'end');
  var hubRect = box(svg, 225, 18, 150, 44, 'Hub', copy.hubSub);
  var parts = {
    agentA: box(svg, 30, 172, 108, 42, 'Agent', copy.agentSub),
    svcA: box(svg, 30, 296, 108, 42, 'orders', 'Service'),
    gwA: box(svg, 160, 234, 88, 42, 'Gateway', 'QUIC'),
    agentB: box(svg, 462, 172, 108, 42, 'Agent', copy.agentSub),
    svcB: box(svg, 462, 296, 108, 42, 'orders', 'ImportedService'),
    gwB: box(svg, 352, 234, 88, 42, 'Gateway', 'QUIC')
  };

  var paths = {
    aHub: el('path', { d: 'M84 172 C 84 110, 200 60, 225 44', fill: 'none', stroke: 'var(--line-strong)', 'stroke-dasharray': '4 4' }, svg),
    hubB: el('path', { d: 'M375 44 C 400 60, 516 110, 516 172', fill: 'none', stroke: 'var(--line-strong)', 'stroke-dasharray': '4 4' }, svg),
    data: el('path', { d: 'M248 255 L 352 255', fill: 'none', stroke: 'var(--line-strong)', 'stroke-width': 2, 'stroke-dasharray': '3 5' }, svg),
    svcGwA: el('path', { d: 'M138 317 C 170 317, 204 300, 204 276', fill: 'none', stroke: 'var(--line-strong)' }, svg),
    gwSvcB: el('path', { d: 'M396 276 C 396 300, 430 317, 462 317', fill: 'none', stroke: 'var(--line-strong)' }, svg)
  };
  var dataLabel = text(svg, 300, 246, 'mTLS 1.3', 'svg-mono');
  var hubNote = text(svg, 300, 84, '', 'svg-mono');
  var token = el('circle', { r: 6, fill: 'var(--accent)', opacity: 0 }, svg);
  var tokenB = el('circle', { r: 6, fill: 'var(--accent)', opacity: 0 }, svg);

  var steps = copy.steps;
  var current = -1;
  var auto = !reduced;
  var autoTimer = null;
  var frame = null;

  // Move a token along one or more path segments (reverse with a leading '-').
  function travel(dot, route, done) {
    cancelAnimationFrame(frame);
    if (reduced || !route.length) { dot.setAttribute('opacity', 0); if (done) done(); return; }
    var segments = route.map(function (name) {
      var reverse = name.charAt(0) === '-';
      var path = paths[reverse ? name.slice(1) : name];
      return { path: path, reverse: reverse, length: path.getTotalLength() };
    });
    var total = segments.reduce(function (sum, seg) { return sum + seg.length; }, 0);
    var start = performance.now();
    var duration = 900 + total * 2.2;
    dot.setAttribute('opacity', 1);
    function tick(now) {
      var distance = Math.min(1, (now - start) / duration) * total;
      for (var i = 0; i < segments.length; i += 1) {
        var seg = segments[i];
        if (distance <= seg.length || i === segments.length - 1) {
          var at = Math.min(seg.length, distance);
          var point = seg.path.getPointAtLength(seg.reverse ? seg.length - at : at);
          dot.setAttribute('cx', point.x);
          dot.setAttribute('cy', point.y);
          break;
        }
        distance -= seg.length;
      }
      if (now - start < duration) frame = requestAnimationFrame(tick);
      else { dot.setAttribute('opacity', 0); if (done) done(); }
    }
    frame = requestAnimationFrame(tick);
  }

  function setLink(connected) {
    paths.data.setAttribute('stroke', connected ? 'var(--accent)' : 'var(--line-strong)');
    paths.data.setAttribute('stroke-width', connected ? 3 : 2);
    paths.data.setAttribute('stroke-dasharray', connected ? '' : '3 5');
    paths.svcGwA.setAttribute('stroke', connected ? 'var(--accent)' : 'var(--line-strong)');
    paths.gwSvcB.setAttribute('stroke', connected ? 'var(--accent)' : 'var(--line-strong)');
    dataLabel.setAttribute('fill', connected ? 'var(--accent-ink)' : 'var(--muted)');
  }

  function highlight(names) {
    Object.keys(parts).forEach(function (name) {
      parts[name].style.stroke = names.indexOf(name) >= 0 ? 'var(--accent)' : '';
      parts[name].style.strokeWidth = names.indexOf(name) >= 0 ? '2' : '';
    });
    hubRect.style.stroke = names.indexOf('hub') >= 0 ? 'var(--accent)' : '';
    hubRect.style.strokeWidth = names.indexOf('hub') >= 0 ? '2' : '';
  }

  function list(title, items, cls) {
    var wrap = document.createElement('div');
    var head = document.createElement('b');
    head.textContent = title;
    wrap.appendChild(head);
    var ul = document.createElement('ul');
    items.forEach(function (item) { var li = document.createElement('li'); li.textContent = item; ul.appendChild(li); });
    wrap.appendChild(ul);
    wrap.className = cls;
    return wrap;
  }

  var buttons = steps.map(function (step, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = (index + 1) + ' · ' + step.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () { auto = false; clearTimeout(autoTimer); go(index); });
    stepsHost.appendChild(button);
    return button;
  });

  var ROUTES = [
    [['aHub', 'hubB']],
    [['aHub', 'hubB'], ['-hubB', '-aHub']],
    [['svcGwA', '-svcGwA', 'aHub', 'hubB']],
    [['svcGwA', 'data', 'gwSvcB']],
    [['-hubB', '-aHub']]
  ];
  var HIGHLIGHTS = [['agentA', 'hub', 'agentB'], ['agentA', 'agentB'], ['svcA', 'hub', 'svcB'], ['gwA', 'gwB', 'svcA', 'svcB'], ['svcA', 'hub']];

  function go(index) {
    current = index;
    var step = steps[index];
    buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', i === index ? 'true' : 'false'); });
    highlight(HIGHLIGHTS[index]);
    setLink(index === 3);
    hubNote.textContent = index === 3 ? copy.hubIdle : '';
    var routes = ROUTES[index];
    travel(token, routes[0]);
    tokenB.setAttribute('opacity', 0);
    if (routes[1]) setTimeout(function () { travel(tokenB, routes[1]); }, reduced ? 0 : 120);

    caption.textContent = '';
    var h = document.createElement('b');
    h.textContent = step.title;
    var p = document.createElement('span');
    p.textContent = step.body;
    caption.appendChild(h);
    caption.appendChild(p);
    caption.dataset.state = index === 4 ? 'hold' : 'ok';

    pane.textContent = '';
    step.status.forEach(function (rowText) {
      var div = document.createElement('div');
      var parts2 = rowText.split('|');
      var name = document.createElement('span');
      name.textContent = parts2[0];
      var value = document.createElement('span');
      value.textContent = parts2[1] || '';
      value.className = /Ready|Accepted|Established/.test(parts2[1] || '') ? 'acc' : /Revoked|Removed|Pending/.test(parts2[1] || '') ? 'warn' : 'dim';
      div.appendChild(name);
      div.appendChild(value);
      pane.appendChild(div);
    });
    var lists = root.querySelector('[data-peering-lists]');
    lists.textContent = '';
    lists.appendChild(list(copy.crosses, step.crosses, 'crosses'));
    lists.appendChild(list(copy.stays, step.stays, 'stays'));

    if (auto) autoTimer = setTimeout(function () { go((current + 1) % steps.length); }, 4600);
  }

  // Show the first step at once; autoplay only while the figure is on screen.
  var playing = auto;
  auto = false;
  go(0);
  auto = playing;
  if (auto && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        clearTimeout(autoTimer);
        if (entry.isIntersecting && auto) autoTimer = setTimeout(function () { go((current + 1) % steps.length); }, 3200);
      });
    }).observe(root);
  }
})();
