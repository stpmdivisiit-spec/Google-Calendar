const DashboardAnalytics = {
    barChartInstance: null,
    doughnutChartInstance: null,

    init: function(data) {
        this.populateCounters(data);
        this.render2DCharts(data);
    },

    populateCounters: function(data) {
        $('#stat-total').text(data.length);
        const currentMonth = new Date().getMonth();
        $('#stat-month').text(data.filter(d => new Date(d['Tanggal Mulai']).getMonth() === currentMonth).length);
        
        // Status dihapus, jadi kolom ini hanya menampilkan kegiatan yang akan datang
        const futureCount = data.filter(d => new Date(d['Tanggal Mulai']) >= new Date()).length;
        $('#stat-completed').text(futureCount).siblings('.text-muted').text('Kegiatan Akan Datang');

        const unitFrequency = {};
        data.forEach(d => { unitFrequency[d.Unit] = (unitFrequency[d.Unit] || 0) + 1; });
        const topUnit = Object.keys(unitFrequency).sort((a,b) => unitFrequency[b] - unitFrequency[a])[0];
        $('#stat-busiest').text(topUnit || '-');
    },

    render2DCharts: function(data) {
        // Ekstraksi data Unit untuk chart lingkaran
        const unitMap = {};
        const monthlyMap = new Array(12).fill(0);

        data.forEach(d => {
            unitMap[d.Unit] = (unitMap[d.Unit] || 0) + 1;
            const date = new Date(d['Tanggal Mulai']);
            monthlyMap[date.getMonth()]++;
        });

        const primaryColor = 'rgba(13, 110, 253, 0.9)';

        if (this.barChartInstance) this.barChartInstance.destroy();
        if (this.doughnutChartInstance) this.doughnutChartInstance.destroy();

        // Bar Chart - Distribusi Bulanan
        this.barChartInstance = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
                datasets: [{ label: 'Jumlah Kegiatan', data: monthlyMap, backgroundColor: primaryColor, borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Doughnut Chart - Berubah menjadi Distribusi Unit
        const bgColors = ['#0d6efd', '#dc3545', '#6f42c1', '#198754', '#0dcaf0', '#fd7e14', '#ffc107', '#20c997', '#e83e8c', '#6610f2'];
        $('#doughnutChart').parent().parent().siblings('.card-header').text('Proporsi Kegiatan per Unit');
        
        this.doughnutChartInstance = new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(unitMap),
                datasets: [{
                    data: Object.values(unitMap),
                    backgroundColor: bgColors.slice(0, Object.keys(unitMap).length)
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
            }
        });
    }
};