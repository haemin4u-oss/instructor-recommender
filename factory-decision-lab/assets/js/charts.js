/* ==========================================================================
   FACTORY DECISION LAB — Lightweight SVG charts (no external dependency)
   ========================================================================== */
(function () {
  var esc = function (s) { return FDL.escape(s); };
  FDL.SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500']; // validated on dark surface
  FDL.STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  /* Line chart with crosshair tooltip */
  function line(o) {
    var W = o.width || 760, H = o.height || 240, L = 40, R = 16, T = 14, B = 30;
    var n = o.labels.length;
    var all = [];
    o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var yMax = o.yMax != null ? o.yMax : niceMax(Math.max.apply(null, all.concat([1])) * 1.1);
    var yMin = o.yMin || 0;
    var x = function (i) { return L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin)); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'line chart') + '">';
    // grid
    for (var g = 0; g <= 4; g++) {
      var gv = yMin + (yMax - yMin) * g / 4;
      svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(gv) + '" y2="' + y(gv) + '"/>';
      svg += '<text class="axis" x="' + (L - 6) + '" y="' + (y(gv) + 4) + '" text-anchor="end">' + (Math.round(gv * 10) / 10) + '</text>';
    }
    if (o.liveFrom != null && o.liveFrom < n) {
      svg += '<rect class="live-zone" x="' + x(o.liveFrom) + '" y="' + T + '" width="' + (W - R - x(o.liveFrom)) + '" height="' + (H - T - B) + '"/>';
      svg += '<text class="axis live-label" x="' + (x(o.liveFrom) + 4) + '" y="' + (T + 11) + '">LIVE</text>';
    }
    (o.refLines || []).forEach(function (r) {
      svg += '<line class="ref" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(r.value) + '" y2="' + y(r.value) + '"/>';
      svg += '<text class="axis" x="' + (W - R) + '" y="' + (y(r.value) - 4) + '" text-anchor="end">' + esc(r.label) + '</text>';
    });
    // x labels
    var step = Math.max(1, Math.ceil(n / (o.maxXLabels || 8)));
    o.labels.forEach(function (lb, i) {
      if (i % step === 0 || (i === n - 1 && (n - 1) % step >= step / 2)) svg += '<text class="axis" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(lb) + '</text>';
    });
    (o.markers || []).forEach(function (mk) {
      svg += '<line class="marker" x1="' + x(mk.index) + '" x2="' + x(mk.index) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
      svg += '<text class="axis marker-label" x="' + (x(mk.index) + 3) + '" y="' + (H - B - 4) + '">' + esc(mk.label) + '</text>';
    });
    o.series.forEach(function (s) {
      var d = '', pen = false;
      s.values.forEach(function (v, i) {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
        pen = true;
      });
      svg += '<path class="series" d="' + d + '" stroke="' + s.color + '"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + (s.width ? ' stroke-width="' + s.width + '"' : '') + '/>';
      // end label
      for (var k = s.values.length - 1; k >= 0; k--) {
        if (s.values[k] != null) {
          svg += '<circle cx="' + x(k) + '" cy="' + y(s.values[k]) + '" r="4" fill="' + s.color + '" class="ring"/>';
          break;
        }
      }
    });
    // hover columns
    var colW = n > 1 ? (W - L - R) / (n - 1) : W;
    o.labels.forEach(function (lb, i) {
      var tip = '<b>' + esc(lb) + '</b>';
      o.series.forEach(function (s) {
        if (s.values[i] != null) tip += '<br><i style="background:' + s.color + '"></i>' + esc(s.name) + ' <b>' + s.values[i] + (o.unit || '') + '</b>';
      });
      svg += '<rect class="hover-col" x="' + (x(i) - colW / 2) + '" y="' + T + '" width="' + colW + '" height="' + (H - T - B) + '" data-tip="' + esc(tip) + '" data-x="' + x(i) + '"/>';
    });
    svg += '</svg>';
    if (o.series.length > 1) {
      svg += '<div class="legend">' + o.series.map(function (s) {
        return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
      }).join('') + '</div>';
    }
    return svg;
  }

  /* Vertical bar chart (single series) */
  function bars(o) {
    var W = o.width || 760, H = o.height || 220, L = 40, R = 12, T = 18, B = 30;
    var n = o.items.length;
    var max = o.max || niceMax(Math.max.apply(null, o.items.map(function (i) { return i.value; }).concat([1])) * 1.15);
    var bw = Math.min(56, (W - L - R) / n - 10);
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'bar chart') + '">';
    for (var g = 0; g <= 4; g++) {
      var gv = max * g / 4;
      svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(gv) + '" y2="' + y(gv) + '"/>';
      svg += '<text class="axis" x="' + (L - 6) + '" y="' + (y(gv) + 4) + '" text-anchor="end">' + (Math.round(gv * 10) / 10) + '</text>';
    }
    (o.refLines || []).forEach(function (r) {
      svg += '<line class="ref" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(r.value) + '" y2="' + y(r.value) + '"/>';
      svg += '<text class="axis" x="' + (W - R) + '" y="' + (y(r.value) - 4) + '" text-anchor="end">' + esc(r.label) + '</text>';
    });
    o.items.forEach(function (it, i) {
      var cx = L + (i + 0.5) * (W - L - R) / n;
      var top = y(it.value), h = Math.max(1, H - B - top);
      var r = Math.min(4, h / 2);
      var xL = cx - bw / 2;
      var path = 'M' + xL + ' ' + (H - B) + ' V' + (top + r) + ' Q' + xL + ' ' + top + ' ' + (xL + r) + ' ' + top +
        ' H' + (xL + bw - r) + ' Q' + (xL + bw) + ' ' + top + ' ' + (xL + bw) + ' ' + (top + r) + ' V' + (H - B) + ' Z';
      svg += '<path d="' + path + '" fill="' + (it.color || FDL.SERIES[0]) + '" class="bar' + (it.muted ? ' muted' : '') + '"/>';
      if (o.showValues !== false) svg += '<text class="val" x="' + cx + '" y="' + (top - 5) + '" text-anchor="middle">' + it.value + (o.unit || '') + '</text>';
      svg += '<text class="axis" x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(it.label) + '</text>';
      svg += '<rect class="hover-col" x="' + (cx - bw / 2 - 4) + '" y="' + T + '" width="' + (bw + 8) + '" height="' + (H - T - B) + '" data-tip="' + esc('<b>' + esc(it.label) + '</b><br>' + it.value + (o.unit || '') + (it.sub ? '<br>' + esc(it.sub) : '')) + '"/>';
    });
    return svg + '</svg>';
  }

  /* Paired horizontal bars (baseline vs today) */
  function pairedH(o) {
    var W = o.width || 760, rowH = 34, L = 150, R = 60, T = 8;
    var H = T + o.items.length * rowH + 8;
    var max = niceMax(Math.max.apply(null, o.items.map(function (i) { return Math.max(i.a, i.b); })) * 1.1);
    var xw = function (v) { return (W - L - R) * v / max; };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || '') + '">';
    o.items.forEach(function (it, i) {
      var y0 = T + i * rowH;
      svg += '<text class="axis lbl" x="' + (L - 8) + '" y="' + (y0 + 18) + '" text-anchor="end">' + esc(it.label) + '</text>';
      svg += '<rect x="' + L + '" y="' + (y0 + 4) + '" width="' + Math.max(2, xw(it.a)) + '" height="10" rx="3" fill="' + o.colorA + '"/>';
      svg += '<rect x="' + L + '" y="' + (y0 + 16) + '" width="' + Math.max(2, xw(it.b)) + '" height="10" rx="3" fill="' + o.colorB + '"/>';
      svg += '<text class="val" x="' + (L + xw(it.b) + 6) + '" y="' + (y0 + 25) + '">' + it.b + (o.unit || '') + '</text>';
      svg += '<rect class="hover-col" x="0" y="' + y0 + '" width="' + W + '" height="' + rowH + '" data-tip="' + esc('<b>' + esc(it.label) + '</b><br>' + o.nameA + ': ' + it.a + (o.unit || '') + '<br>' + o.nameB + ': ' + it.b + (o.unit || '')) + '"/>';
    });
    svg += '</svg><div class="legend"><span><i style="background:' + o.colorA + '"></i>' + esc(o.nameA) + '</span><span><i style="background:' + o.colorB + '"></i>' + esc(o.nameB) + '</span></div>';
    return svg;
  }

  function sparkline(values, color) {
    var W = 90, H = 26;
    var v = values.filter(function (x) { return x != null; });
    if (v.length < 2) return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '"></svg>';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
    if (mx - mn < 0.5) { mx += 0.25; mn -= 0.25; }
    var d = v.map(function (val, i) {
      return (i ? 'L' : 'M') + (i * W / (v.length - 1)).toFixed(1) + ' ' + (H - 3 - (val - mn) / (mx - mn) * (H - 6)).toFixed(1);
    }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + d + '" stroke="' + color + '"/></svg>';
  }

  /* Radar (0-100) */
  function radar(o) {
    var S = o.size || 360, cx = S / 2, cy = S / 2 + 6, Rr = S / 2 - 60, PAD = 70;
    var n = o.axes.length;
    var pt = function (i, v) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * Rr * v / 100, cy + Math.sin(a) * Rr * v / 100];
    };
    var svg = '<svg class="chart radar" viewBox="' + (-PAD) + ' 0 ' + (S + PAD * 2) + ' ' + (S + 10) + '" role="img" aria-label="역량 레이더">';
    [25, 50, 75, 100].forEach(function (lv) {
      svg += '<polygon class="grid-poly" points="' + o.axes.map(function (_, i) { return pt(i, lv).join(','); }).join(' ') + '"/>';
    });
    o.axes.forEach(function (ax, i) {
      var p = pt(i, 100), pl = pt(i, 122);
      svg += '<line class="grid" x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '"/>';
      var anchor = Math.abs(pl[0] - cx) < 10 ? 'middle' : pl[0] > cx ? 'start' : 'end';
      svg += '<text class="axis lbl" x="' + pl[0] + '" y="' + (pl[1] + 4) + '" text-anchor="' + anchor + '">' + esc(ax) + '</text>';
    });
    o.series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return pt(i, v).join(','); }).join(' ');
      svg += '<polygon points="' + pts + '" fill="' + s.color + '" fill-opacity="0.18" stroke="' + s.color + '" stroke-width="2"/>';
      s.values.forEach(function (v, i) {
        var p = pt(i, v);
        svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + s.color + '" class="ring" data-tip="' + esc('<b>' + esc(s.name || '') + '</b><br>' + esc(o.axes[i]) + ': ' + v) + '"/>';
      });
    });
    svg += '</svg>';
    if (o.series.length > 1) {
      svg += '<div class="legend">' + o.series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    }
    return svg;
  }

  /* Global tooltip */
  function initTooltip() {
    var tip = document.createElement('div');
    tip.id = 'fdl-tip';
    document.body.appendChild(tip);
    document.addEventListener('mousemove', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (!t) { tip.style.display = 'none'; return; }
      tip.innerHTML = t.getAttribute('data-tip');
      tip.style.display = 'block';
      var x = e.clientX + 14, y = e.clientY + 14;
      var r = tip.getBoundingClientRect();
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
  }

  FDL.charts = { line: line, bars: bars, pairedH: pairedH, sparkline: sparkline, radar: radar, initTooltip: initTooltip };
})();
