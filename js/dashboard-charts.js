const DashboardAnalytics = {
    // Menyimpan instance grafik agar bisa dihancurkan saat data di-update
    barChartInstance: null,
    doughnutChartInstance: null,

    init: function(data) {
        this.populateCounters(data);
        this.render2DCharts(data);
    },

    populateCounters: function(data) {
        $('#stat-total').text(data.length);
        
        const currentMonth = new Date().getMonth();
        const monthCount = data.filter(d => new Date(d['Tanggal Mulai']).getMonth() === currentMonth).length;
        $('#stat-month').text(monthCount);

        const doneCount = data.filter(d => d.Status === 'Selesai').length;
        $('#stat-completed').text(doneCount);

        const unitFrequency = {};
        data.forEach(d => { unitFrequency[d.Unit] = (unitFrequency[d.Unit] || 0) + 1; });
        const topUnit = Object.keys(unitFrequency).sort((a,b) => unitFrequency[b] - unitFrequency[a])[0];
        $('#stat-busiest').text(topUnit || '-');
    },

    render2DCharts: function(data) {
        const statusMap = { 'Perencanaan': 0, 'Berjalan': 0, 'Selesai': 0, 'Ditunda': 0 };
        const monthlyMap = new Array(12).fill(0);

        data.forEach(d => {
            if (statusMap[d.Status] !== undefined) statusMap[d.Status]++;
            const date = new Date(d['Tanggal Mulai']);
            monthlyMap[date.getMonth()]++;
        });

        const primaryColor = 'rgba(13, 110, 253, 0.9)';
        const successColor = 'rgba(25, 135, 84, 0.9)';
        const dangerColor = 'rgba(220, 53, 69, 0.9)';
        const secondaryColor = 'rgba(108, 117, 125, 0.9)';

        // Hancurkan grafik lama jika ada (untuk mencegah penumpukan saat update data)
        if (this.barChartInstance) this.barChartInstance.destroy();
        if (this.doughnutChartInstance) this.doughnutChartInstance.destroy();

        // Bar Chart
        this.barChartInstance = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
                datasets: [{
                    label: 'Jumlah Kegiatan',
                    data: monthlyMap,
                    backgroundColor: primaryColor,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: false }, legend: { display: false } }
            }
        });

        // Doughnut Chart
        this.doughnutChartInstance = new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusMap),
                datasets: [{
                    data: Object.values(statusMap),
                    backgroundColor: [secondaryColor, primaryColor, successColor, dangerColor]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { title: { display: false }, legend: { position: 'bottom' } }
            }
        });
    }
};