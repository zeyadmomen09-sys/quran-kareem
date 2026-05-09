document.addEventListener('DOMContentLoaded', function() {
    // الثوابت
    const MP3QURAN_API = 'https://mp3quran.net/api/v3';
    const QURAN_API = 'https://api.quran.com/api/v4';

    const pages = document.querySelectorAll('.page');
    const audioPlayer = document.getElementById('audioPlayer');
    const playerBar = document.getElementById('playerBar');
    const playPauseBtn = document.getElementById('playPauseBtn');

    let reciters = [];
    let currentReciter = null;
    let currentSurahNum = null;
    window.currentReciterId = null;
    window.currentSurahNum = null;

    const suraNames = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الإنفطار","المطففين","الإنشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

    // ===== نظام المميزات =====
    const UserFeatures = {
        favorites: JSON.parse(localStorage.getItem('quran_favs') || '[]'),
        wird: JSON.parse(localStorage.getItem('quran_wird') || '{"goal": 0, "done": 0, "date": ""}'),

        toggleFavorite(type, id, name) {
            const key = `${type}_${id}`;
            const index = this.favorites.findIndex(f => f.key === key);
            if (index > -1) this.favorites.splice(index, 1);
            else this.favorites.push({ key, type, id, name });
            localStorage.setItem('quran_favs', JSON.stringify(this.favorites));
            this.updateFavButtons();
            if(document.getElementById('page-favorites').style.display === 'block') loadFavorites();
        },

        isFavorite(type, id) {
            return this.favorites.some(f => f.key === `${type}_${id}`);
        },

        updateFavButtons() {
            document.querySelectorAll('.fav-btn').forEach(btn => {
                const type = btn.dataset.type, id = btn.dataset.id;
                const isActive = this.isFavorite(type, id);
                btn.classList.toggle('active', isActive);
                btn.innerHTML = isActive? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            });
        },

        saveLastPlayed(reciterId, surahNum, time, surahName, reciterName) {
            const data = { reciterId, surahNum, time, surahName, reciterName, timestamp: Date.now() };
            localStorage.setItem('quran_last_played', JSON.stringify(data));
            this.showContinueBtn();
        },

        getLastPlayed() {
            return JSON.parse(localStorage.getItem('quran_last_played') || 'null');
        },

        showContinueBtn() {
            const last = this.getLastPlayed();
            const btn = document.getElementById('continueBtn');
            if (last && btn) {
                btn.innerHTML = `▶️ أكمل: ${last.surahName} - ${last.reciterName}`;
                btn.classList.add('show');
                btn.onclick = () => playLastSurah(last);
            }
        },

        setWirdGoal(pages) {
            const today = new Date().toDateString();
            if (this.wird.date!== today) this.wird = { goal: pages, done: 0, date: today };
            else this.wird.goal = pages;
            localStorage.setItem('quran_wird', JSON.stringify(this.wird));
            this.updateWirdBar();
        },

        updateWirdBar() {
            const bar = document.getElementById('wirdBar');
            const today = new Date().toDateString();
            if (this.wird.goal > 0 && this.wird.date === today) {
                bar.classList.add('show');
                const percent = Math.min(100, (this.wird.done / this.wird.goal) * 100);
                document.getElementById('wirdProgressFill').style.width = percent + '%';
                document.getElementById('wirdStats').innerHTML = `<span>تم: ${this.wird.done} صفحة</span><span>الهدف: ${this.wird.goal} صفحة</span>`;
            } else {
                bar.classList.remove('show');
            }
        },

        init() {
            this.showContinueBtn();
            this.updateWirdBar();
            this.updateFavButtons();
        }
    };
    window.UserFeatures = UserFeatures;
    window.setWird = function() {
        const pages = prompt('كم صفحة ناوي تقرأ اليوم؟', UserFeatures.wird.goal || 5);
        if (pages &&!isNaN(pages)) UserFeatures.setWirdGoal(parseInt(pages));
    };

    // ===== التنقل =====
    document.querySelectorAll('.top-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.top-nav a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            showPage(this.dataset.page);
        });
    });

    function showPage(pageName) {
        pages.forEach(p => p.style.display = 'none');
        document.getElementById('page-' + pageName).style.display = 'block';
        if (pageName === 'quran') loadMushaf();
        if (pageName === 'listen') loadReciters();
        if (pageName === 'download') loadDownloadPage();
        if (pageName === 'favorites') loadFavorites();
        if (pageName === 'riyad') loadRiyadSalihin();
    }

    // ===== المصحف - سريع =====
    async function loadMushaf() {
        const content = document.getElementById('mushafContent');
        if (content.dataset.loaded === 'true') return;
        content.innerHTML = '<div class="loader">جاري تحميل الفاتحة والبقرة...</div>';
        try {
            let html = '';
            // نحمل أول 3 سور بس عشان السرعة
            for (let i = 1; i <= 3; i++) {
                const res = await fetch(`${QURAN_API}/quran/verses/uthmani?chapter_number=${i}`);
                const data = await res.json();
                html += `<div class="sura-header"><h3>سورة ${suraNames[i-1]}</h3></div>`;
                if (i!== 1 && i!== 9) html += '<p style="text-align:center; font-family: \'Amiri Quran\', serif; font-size: 1.8rem; margin: 20px 0;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
                data.verses.forEach(v => {
    const ayahtext = v.text_uthmani || v.text || '';
    html += `<span class="mushaf-ayah">${ayahtext} <span class="ayah-num">﴿${v.verse_number}﴾</span> </span>`;
});
            }
            html += '<button onclick="loadMoreMushaf()" style="width:100%;padding:15px;background:var(--primary);color:#fff;border:none;border-radius:10px;margin-top:20px;cursor:pointer;font-size:1rem;">تحميل باقي السور (111 سورة)</button>';
            content.innerHTML = html;
            content.dataset.loaded = 'true';
        } catch (err) {
            content.innerHTML = '<p class="empty-msg">فشل التحميل. اتأكد من النت</p>';
        }
    }

    window.loadMoreMushaf = async function() {
        const content = document.getElementById('mushafContent');
        const btn = content.querySelector('button');
        btn.innerHTML = 'جاري التحميل...';
        btn.disabled = true;

        try {
            let html = content.innerHTML.replace(btn.outerHTML, '');
            for (let i = 4; i <= 114; i++) {
                const res = await fetch(`${QURAN_API}/quran/verses/uthmani?chapter_number=${i}`);
                const data = await res.json();
                html += `<div class="sura-header"><h3>سورة ${suraNames[i-1]}</h3></div>`;
                if (i!== 9) html += '<p style="text-align:center; font-family: \'Amiri Quran\', serif; font-size: 1.8rem; margin: 20px 0;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
                data.verses.forEach(v => {
                    html += `<span class="mushaf-ayah">${v.text_uthmani} <span class="ayah-num">﴿${v.verse_number}﴾</span> </span>`;
                });
                if (i % 10 === 0) content.innerHTML = html; // تحديث كل 10 سور
            }
            content.innerHTML = html;
        } catch (err) {
            btn.innerHTML = 'فشل التحميل - حاول تاني';
            btn.disabled = false;
        }
    };

    // ===== الاستماع =====
    async function loadReciters() {
        if (reciters.length > 0) {
            renderListenGrid();
            return;
        }
        const select = document.getElementById('reciterSelect');
        try {
            const res = await fetch(`${MP3QURAN_API}/reciters?language=ar`);
            const data = await res.json();
            reciters = data.reciters.filter(r => r.moshaf[0].surah_total === 114);
            let options = '<option value="">اختار القارئ</option>';
            reciters.forEach(r => options += `<option value="${r.id}">${r.name}</option>`);
            select.innerHTML = options;
            renderListenGrid();
        } catch (err) {
            select.innerHTML = '<option>فشل التحميل</option>';
        }
    }

    function renderListenGrid() {
        const grid = document.getElementById('listenSuraGrid');
        grid.innerHTML = '';
        suraNames.forEach((name, i) => {
            const card = document.createElement('div');
            card.className = 'sura-card surah-item';
            card.innerHTML = `
                <h3>${i+1}. ${name}</h3>
                <div class="actions">
                    <button onclick="playSura(${i+1})"><i class="fa-solid fa-play"></i> تشغيل</button>
                    <button class="fav-btn" data-type="surah" data-id="${i+1}" data-name="${name}"
                            onclick="event.stopPropagation(); UserFeatures.toggleFavorite('surah', '${i+1}', '${name}')">
                        <i class="fa-regular fa-heart"></i>
                    </button>
                </div>`;
            grid.appendChild(card);
        });
        UserFeatures.updateFavButtons();
    }

    window.playSura = function(suraNum) {
        const selectElement = document.getElementById('reciterSelect');
        currentReciter = reciters.find(r => r.id == selectElement.value);
        if (!currentReciter) {
            alert('اختار القارئ الأول');
            return;
        }
        const server = currentReciter.moshaf[0].server;
        const suraStr = String(suraNum).padStart(3, '0');
        audioPlayer.src = `${server}${suraStr}.mp3`;
        audioPlayer.play();

        currentSurahNum = suraNum;
        window.currentReciterId = currentReciter.id;
        window.currentSurahNum = suraNum;

        document.querySelector('.current-surah-name').innerText = 'سورة ' + suraNames[suraNum-1];
        document.querySelector('.current-reciter-name').innerText = currentReciter.name;
        playerBar.style.display = 'block';
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    };

    window.playLastSurah = function(last) {
        if (reciters.length === 0) {
            loadReciters().then(() => {
                document.getElementById('reciterSelect').value = last.reciterId;
                playSura(last.surahNum);
                setTimeout(() => { if(audioPlayer) audioPlayer.currentTime = last.time; }, 1000);
            });
            return;
        }
        document.getElementById('reciterSelect').value = last.reciterId;
        playSura(last.surahNum);
        setTimeout(() => { if(audioPlayer) audioPlayer.currentTime = last.time; }, 1000);
    };

    // ===== التحميل - متصلح 100% =====
    async function loadDownloadPage() {
        const select = document.getElementById('downloadReciterSelect');
        if (reciters.length === 0) {
            try {
                const res = await fetch(`${MP3QURAN_API}/reciters?language=ar`);
                const data = await res.json();
                reciters = data.reciters.filter(r => r.moshaf[0].surah_total === 114);
            } catch (err) {
                select.innerHTML = '<option>فشل التحميل</option>';
                return;
            }
        }
        let options = '<option value="">اختار القارئ</option>';
        reciters.forEach(r => options += `<option value="${r.id}">${r.name}</option>`);
        select.innerHTML = options;
        select.onchange = renderDownloadList; // مهم: نربط الحدث هنا
    }

    function renderDownloadList() {
        const reciterId = document.getElementById('downloadReciterSelect').value;
        const list = document.getElementById('downloadList');
        if (!reciterId) {
            list.innerHTML = '';
            return;
        }
        const reciter = reciters.find(r => r.id == reciterId);
        if (!reciter) return;
        const server = reciter.moshaf[0].server;
        let html = '';
        suraNames.forEach((name, i) => {
            const suraStr = String(i+1).padStart(3, '0');
            html += `
                <div class="download-item surah-item">
                    <span>${i+1}. سورة ${name}</span>
                    <button onclick="window.open('${server}${suraStr}.mp3', '_blank')">
                        <i class="fa-solid fa-download"></i> تحميل
                    </button>
                </div>`;
        });
        list.innerHTML = html;
    }

    // ===== المفضلة =====
    function loadFavorites() {
        const list = document.getElementById('favoritesList');
        const favs = UserFeatures.favorites.filter(f => f.type === 'surah');
        if (favs.length === 0) {
            list.innerHTML = '<p class="empty-msg">لسه مضفتش سور للمفضلة. دوس على <i class="fa-solid fa-heart"></i> جنب أي سورة</p>';
            return;
        }
        let html = '';
        favs.forEach(f => {
            html += `
                <div class="download-item">
                    <span>${f.id}. سورة ${f.name}</span>
                    <button onclick="UserFeatures.toggleFavorite('surah', '${f.id}', '${f.name}')" style="background:#e91e63;">
                        <i class="fa-solid fa-trash"></i> حذف
                    </button>
                </div>`;
        });
        list.innerHTML = html;
    }

    // ===== رياض الصالحين =====
    function loadRiyadSalihin() {
        document.getElementById('riyadContent').innerHTML = '<p class="empty-msg">جاري إضافة الأحاديث...</p>';
    }

    // ===== البحث مع Debounce =====
    // let searchTimeout;
    // document.getElementById('searchBox')?.addEventListener('input', function(e) {
    //     clearTimeout(searchTimeout);
    //     searchTimeout = setTimeout(() => {
    //         const term = e.target.value.toLowerCase();
    //         document.querySelectorAll('.sura-card,.download-item').forEach(item => {
    //             item.style.display = item.textContent.toLowerCase().includes(term)? 'flex' : 'none';
    //         });
    //     }, 300);
    // });
// البحث - متصلح
// let searchTimeout;
// document.getElementById('searchBox')?.addEventListener('input', function(e) {
//     clearTimeout(searchTimeout);
//     searchTimeout = setTimeout(() => {
//         const term = e.target.value.toLowerCase().trim();
//         // بيدور في كروت السور + عناصر التحميل + أي عنصر فيه اسم سورة
//         document.querySelectorAll('.sura-card, .download-item, .mushaf-ayah').forEach(item => {
//             const text = item.textContent.toLowerCase();
//             item.style.display = text.includes(term) || term === '' ? '' : 'none';
//         });
//     }, 300);
// });// ===== البحث الذكي - يظهر السورة كاملة =====
let searchTimeout;
document.getElementById('searchBox')?.addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const term = e.target.value.trim();
        
        // ===== 1. صفحة المصحف =====
        const mushafContent = document.getElementById('mushafContent');
        if (mushafContent && mushafContent.style.display !== 'none') {
            const allHeaders = mushafContent.querySelectorAll('.sura-header');
            
            if (term === '') {
                // لو البحث فاضي رجع كل حاجة
                mushafContent.querySelectorAll('*').forEach(el => el.style.display = '');
                return;
            }

            let foundMatch = false;
            allHeaders.forEach(header => {
                const suraName = header.textContent.replace('سورة ', '').trim();
                
                // لو الاسم مطابق
                if (suraName.includes(term)) {
                    foundMatch = true;
                    header.style.display = ''; // اظهر اسم السورة
                    
                    // اظهر كل الآيات لحد السورة اللي بعدها
                    let next = header.nextElementSibling;
                    while(next && !next.classList.contains('sura-header') && next.tagName !== 'BUTTON') {
                        next.style.display = '';
                        next = next.nextElementSibling;
                    }
                } else {
                    // اخفي السورة دي وكل آياتها
                    header.style.display = 'none';
                    let next = header.nextElementSibling;
                    while(next && !next.classList.contains('sura-header') && next.tagName !== 'BUTTON') {
                        next.style.display = 'none';
                        next = next.nextElementSibling;
                    }
                }
            });
            
            // اخفي زرار "تحميل باقي السور" وقت البحث
            const loadMoreBtn = mushafContent.querySelector('button');
            if (loadMoreBtn) loadMoreBtn.style.display = foundMatch ? 'none' : '';
        }

        // ===== 2. صفحة الاستماع =====
        document.querySelectorAll('#listenSuraGrid .sura-card').forEach(card => {
            const suraName = card.querySelector('h3')?.textContent.replace(/^\d+\.\s*/, '').trim();
            const show = term === '' || suraName.includes(term);
            card.style.display = show ? '' : 'none';
        });

        // ===== 3. صفحة التحميل =====
        document.querySelectorAll('#downloadList .download-item').forEach(item => {
            const suraName = item.querySelector('span')?.textContent.replace(/^\d+\.\s*سورة\s*/, '').trim();
            const show = term === '' || suraName.includes(term);
            item.style.display = show ? 'flex' : 'none';
        });

    }, 200); // سرعته 200ms عشان يبقى فوري
});
    // ===== مشغل الصوت =====
    playPauseBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
            audioPlayer.pause();
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    });

    document.getElementById('closePlayer').addEventListener('click', () => {
        audioPlayer.pause();
        playerBar.style.display = 'none';
    });

    audioPlayer.addEventListener('timeupdate', () => {
        const current = audioPlayer.currentTime, duration = audioPlayer.duration;
        document.getElementById('currentTime').textContent = formatTime(current);
        document.getElementById('duration').textContent = formatTime(duration);
        document.getElementById('progressBar').value = (current / duration) * 100 || 0;

        if (window.currentReciterId && window.currentSurahNum && Math.floor(current) % 5 === 0) {
            const surahName = document.querySelector('.current-surah-name')?.textContent || '';
            const reciterName = document.querySelector('.current-reciter-name')?.textContent || '';
            UserFeatures.saveLastPlayed(window.currentReciterId, window.currentSurahNum, current, surahName, reciterName);
        }
    });

    audioPlayer.addEventListener('play', () => requestWakeLock());
    audioPlayer.addEventListener('pause', () => releaseWakeLock());

    document.getElementById('progressBar').addEventListener('input', (e) => {
        audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
    });

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    // ===== منع إطفاء الشاشة + مؤقت النوم =====
    let wakeLock = null;
    async function requestWakeLock() {
        try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
    }
    function releaseWakeLock() {
        if (wakeLock!== null) { wakeLock.release(); wakeLock = null; }
    }
    window.sleepTimer = function(minutes) {
        alert(`سيتم إيقاف التلاوة بعد ${minutes} دقيقة`);
        setTimeout(() => {
            audioPlayer.pause();
            alert('تم إيقاف التلاوة - تصبح على خير ❤️');
        }, minutes * 60000);
    };

    // ===== اللغات =====
    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');
    langBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => langMenu?.classList.remove('active'));

    // تشغيل
    UserFeatures.init();
    showPage('quran');
});


// ===== نظام الشكاوى والتواصل =====
window.openComplaintBox = function() {
    document.getElementById('complaintModal').style.display = 'block';
}

window.closeComplaintBox = function() {
    document.getElementById('complaintModal').style.display = 'none';
}

// قفل النافذة لما تدوس براها
window.onclick = function(event) {
    const modal = document.getElementById('complaintModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

window.sendComplaint = function(e) {
    e.preventDefault();
    
    const name = document.getElementById('userName').value || 'مستخدم';
    const email = document.getElementById('userEmail').value || 'غير محدد';
    const type = document.getElementById('complaintType').value;
    const msg = document.getElementById('complaintMsg').value;
    
    // 1. ابعت على الواتساب
    const whatsappText = `*${type}*%0A%0Aالاسم: ${name}%0Aالإيميل: ${email}%0A%0Aالرسالة:%0A${msg}`;
    const whatsappLink = `https://wa.me/201234567890?text=${whatsappText}`;
    
    // 2. ابعت على الإيميل
    const emailSubject = `شكوى من موقع القرآن: ${type}`;
    const emailBody = `الاسم: ${name}%0D%0Aالإيميل: ${email}%0D%0Aالنوع: ${type}%0D%0A%0D%0Aالرسالة:%0D%0A${msg}`;
    const emailLink = `mailto:your-email@gmail.com?subject=${emailSubject}&body=${emailBody}`;
    
    // افتح الواتساب
    window.open(whatsappLink, '_blank');
    
    // افتح الإيميل بعد ثانية
    setTimeout(() => {
        window.location.href = emailLink;
    }, 1000);
    
    // قفل النافذة وريسيت الفورم
    closeComplaintBox();
    document.getElementById('complaintForm').reset();
    alert('تم إرسال رسالتك بنجاح! هيتم فتح الواتساب والإيميل للتواصل معنا ❤️');
}