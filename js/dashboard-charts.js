const DashboardAnalytics = {
    barChartInstance: null, doughnutChartInstance: null, picBarChartInstance: null, dayOfWeekChartInstance: null, avgDurationChartInstance: null,

    init: function(data) {
        if (typeof feather !== 'undefined') feather.replace();
        this.populateCounters(data); this.renderHeatmap(data); this.renderCharts(data); this.detectConflicts(data);
    },

    populateCounters: function(data) {
        try {
            const currentDt = new Date(); const curMonth = currentDt.getMonth(); const curYear = currentDt.getFullYear();
            $('#stat-total').text(data.length);
            $('#stat-upcoming').text(data.filter(d => new Date(d['Tanggal Mulai']) >= currentDt).length);
            const thisMonthData = data.filter(d => { const dDt = new Date(d['Tanggal Mulai']); return !isNaN(dDt.getTime()) && dDt.getMonth() === curMonth && dDt.getFullYear() === curYear; });
            $('#stat-month').text(thisMonthData.length);

            const unitFreq = {}; thisMonthData.forEach(d => unitFreq[d.Unit] = (unitFreq[d.Unit] || 0) + 1);
            $('#stat-busiest-unit').text(Object.keys(unitFreq).sort((a,b) => unitFreq[b] - unitFreq[a])[0] || '-');

            const picFreq = {}; thisMonthData.forEach(d => picFreq[d.PIC] = (picFreq[d.PIC] || 0) + 1);
            $('#stat-busiest-pic').text((Object.keys(picFreq).sort((a,b) => picFreq[b] - picFreq[a])[0] || '-').split(',')[0]);
        } catch (e) {}
    },

    detectConflicts: function(data) {
        try {
            let conflicts = []; let conflictIds = new Set();
            for (let i = 0; i < data.length; i++) {
                for (let j = i + 1; j < data.length; j++) {
                    let s1 = new Date(data[i]['Tanggal Mulai']).getTime(); let e1 = new Date(data[i]['Tanggal Selesai']).getTime();
                    let s2 = new Date(data[j]['Tanggal Mulai']).getTime(); let e2 = new Date(data[j]['Tanggal Selesai']).getTime();
                    if (!isNaN(s1) && !isNaN(e1) && !isNaN(s2) && !isNaN(e2)) {
                        if (s1 <= e2 && s2 <= e1) {
                            conflicts.push({ eventA: data[i], eventB: data[j] });
                            conflictIds.add(data[i]['ID (UUID)']); conflictIds.add(data[j]['ID (UUID)']);
                        }
                    }
                }
            }
            $('#stat-conflicts').text(conflicts.length); $('#badge-conflict-count').text(conflicts.length);
            $('#stat-conflict-rate').text(`${data.length > 0 ? ((conflictIds.size / data.length) * 100).toFixed(1) : 0}%`);

            const listCont = $('#conflict-list'); listCont.empty();
            if (conflicts.length === 0) listCont.append('<div class="p-4 text-center text-muted small"><i class="fas fa-check-circle text-success me-2"></i>Jadwal aman.</div>');
            else {
                conflicts.forEach(c => {
                    const dtStr = new Date(c.eventA['Tanggal Mulai']).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    listCont.append(`<div class="list-group-item list-group-item-action"><div class="d-flex w-100 justify-content-between mb-1"><h6 class="mb-0 fw-bold text-danger">⚠️ Tabrakan</h6><small class="text-muted fw-bold">${dtStr}</small></div><div class="small mb-1"><b>1.</b> ${c.eventA['Program Kerja']} <span class="text-primary">(${c.eventA.Unit})</span></div><div class="small"><b>2.</b> ${c.eventB['Program Kerja']} <span class="text-primary">(${c.eventB.Unit})</span></div></div>`);
                });
            }
        } catch (e) {}
    },

    renderHeatmap: function(data) {
        try {
            const cont = $('#heatmap-container'); if (cont.length === 0) return; cont.empty();
            const heatData = Array.from({length: 7}, () => new Array(12).fill(0));
            const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const dLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

            data.forEach(d => {
                const dt = new Date(d['Tanggal Mulai']);
                if (!isNaN(dt.getTime())) {
                    let day = dt.getDay() - 1; if (day === -1) day = 6;
                    heatData[day][dt.getMonth()]++;
                }
            });

            let maxVal = Math.max(...heatData.flat(), 1);
            let html = '<div style="display:flex; flex-direction:column; gap:6px; overflow-x:auto; padding:10px 0;"><div style="display:flex; gap:6px; margin-left: 36px;">';
            mNames.forEach(m => html += `<div style="width: 38px; text-align:center; font-size:11px; color:#6c757d; font-weight:bold;">${m}</div>`);
            html += '</div>';

            for (let r = 0; r < 7; r++) {
                html += `<div style="display:flex; gap:6px; align-items:center;"><div style="width: 30px; font-size:11px; color:#6c757d; text-align:right; padding-right:4px; font-weight:bold;">${dLabels[r]}</div>`;
                for (let c = 0; c < 12; c++) {
                    let val = heatData[r][c], lvl = 'heatmap-empty';
                    if (val > 0) { const ratio = val / maxVal; lvl = ratio > 0.75 ? 'heatmap-high' : (ratio > 0.40 ? 'heatmap-medium' : 'heatmap-low'); }
                    html += `<div class="heatmap-box ${lvl}" title="${val} Kegiatan">${val > 0 ? val : ''}</div>`;
                }
                html += '</div>';
            }
            cont.html(html + '</div>');
        } catch (e) {}
    },

    renderCharts: function(data) {
        const uMap = {}, tMap = {}, picMap = {}; const dCount = [0,0,0,0,0,0,0]; 
        const uSum = {}, uCount = {}; const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        data.forEach(d => {
            const sDt = new Date(d['Tanggal Mulai']), eDt = new Date(d['Tanggal Selesai']);
            if (!isNaN(sDt.getTime())) {
                uMap[d.Unit] = (uMap[d.Unit] || 0) + 1;
                if (!picMap[d.PIC]) picMap[d.PIC] = [];
                picMap[d.PIC].push({ nama: d['Program Kerja'], tanggal: d['Tanggal Mulai'] });
                dCount[sDt.getDay()]++;
                tMap[`${sDt.getFullYear()}-${String(sDt.getMonth()+1).padStart(2,'0')}`] = (tMap[`${sDt.getFullYear()}-${String(sDt.getMonth()+1).padStart(2,'0')}`] || 0) + 1;
                if (!isNaN(eDt.getTime())) {
                    uSum[d.Unit] = (uSum[d.Unit] || 0) + Math.max(1, Math.round((eDt - sDt) / 86400000) + 1);
                    uCount[d.Unit] = (uCount[d.Unit] || 0) + 1;
                }
            }
        });

        const ordDCount = [dCount[1], dCount[2], dCount[3], dCount[4], dCount[5], dCount[6], dCount[0]];
        let avgLbls = Object.keys(uSum); let avgVals = avgLbls.map(u => (uSum[u] / uCount[u]).toFixed(1));
        if (avgLbls.length === 0) { avgLbls = ['-']; avgVals = [0]; }

        const tKeys = Object.keys(tMap).sort(); const tLbls = [], tVals = [];
        tKeys.forEach(k => { const p = k.split('-'); tLbls.push(`${mNames[parseInt(p[1])-1]} ${p[0]}`); tVals.push(tMap[k]); });

        const colors = ['#0d6efd', '#dc3545', '#6f42c1', '#198754', '#0dcaf0', '#fd7e14', '#ffc107', '#20c997', '#e83e8c', '#6610f2', '#d63384'];

        [this.barChartInstance, this.doughnutChartInstance, this.dayOfWeekChartInstance, this.avgDurationChartInstance, this.picBarChartInstance].forEach(c => { if(c) c.destroy(); });

        try { const ctx = document.getElementById('barChart'); if (ctx && tLbls.length > 0) this.barChartInstance = new Chart(ctx, { type: 'bar', data: { labels: tLbls, datasets: [{ label: 'Total Kegiatan', data: tVals, backgroundColor: '#0d6efd', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); } catch(e){}
        try { const ctx = document.getElementById('doughnutChart'); if (ctx && Object.keys(uMap).length > 0) this.doughnutChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(uMap), datasets: [{ data: Object.values(uMap), backgroundColor: colors }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } } }); } catch(e){}
        try { const ctx = document.getElementById('dayOfWeekChart'); if (ctx) this.dayOfWeekChartInstance = new Chart(ctx, { type: 'bar', data: { labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'], datasets: [{ data: ordDCount, backgroundColor: '#6f42c1', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); } catch(e){}
        try { const ctx = document.getElementById('avgDurationChart'); if (ctx) this.avgDurationChartInstance = new Chart(ctx, { type: 'bar', data: { labels: avgLbls.map(u => u.split(' ').slice(0, 2).join(' ')), datasets: [{ data: avgVals, backgroundColor: '#198754', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); } catch(e){}
        try {
            const ctx = document.getElementById('picBarChart');
            if (ctx && Object.keys(picMap).length > 0) {
                const sPIC = Object.keys(picMap).sort((a,b) => picMap[b].length - picMap[a].length).slice(0, 10);
                this.picBarChartInstance = new Chart(ctx, { type: 'bar', data: { labels: sPIC.map(p => p.split(' ').slice(0, 2).join(' ')), datasets: [{ data: sPIC.map(p => picMap[p].length), backgroundColor: '#0dcaf0', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { padding: 12, callbacks: { title: c => sPIC[c[0].dataIndex], label: c => `Jumlah: ${c.raw}`, afterBody: c => { const ev = picMap[sPIC[c[0].dataIndex]].sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal)); let l = ['', 'Rincian:']; for(let i=0; i<ev.length; i++) { if(i>=10){ l.push(`... dan ${ev.length-10} lainnya.`); break; } const dt = new Date(ev[i].tanggal); l.push(`• ${ev[i].nama.substring(0,25)} (${mNames[dt.getMonth()]} ${dt.getFullYear()})`); } return l; } } } }, onClick: (e, els) => { if(elements.length > 0) { $('.menu-link[data-target="table-view"]').trigger('click'); setTimeout(() => { $('#dataTable').DataTable().column(5).search(sPIC[els[0].index]).draw(); }, 250); } } } });
            }
        } catch(e){}
    }
};