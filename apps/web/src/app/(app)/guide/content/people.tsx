/** Kullanma Kılavuzu — "Kişiler" bölümü. */
export function PeopleGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Kişiler</strong> sayfası montaj personelini tutar. Buradaki kişiler,{" "}
        <strong>Ekipler</strong> sayfasında ekiplere üye olarak eklenir. Bir kişinin hangi ekipte
        olduğu ve <strong>izinli olduğu günler</strong>, o ekibin günlük montaj kapasitesini etkiler.
      </p>

      <h2>Liste ekranı</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Kişinin adı.
        </li>
        <li>
          <strong>Ekip Başı / Üye:</strong> Kişinin ekip başı olarak işaretlenip işaretlenmediği.
        </li>
        <li>
          <strong>Düzenle / Sil:</strong> Kişiyi düzenlemek veya kaydı kaldırmak için.
        </li>
      </ul>
      <p>
        Sağ üstteki <strong>“Yeni Kişi”</strong> butonuyla yeni personel eklenir.
      </p>

      <h2>Yeni kişi ekleme — alanlar</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Kişinin adı (zorunlu).
        </li>
        <li>
          <strong>Ekip Başı:</strong> Kişi bir ekibin başıysa işaretlenir. Bu bir{" "}
          <strong>etikettir</strong> — kimin ekip lideri olduğunu göstermek içindir, planlamayı tek
          başına değiştirmez.
        </li>
      </ul>

      <h2>İzinler</h2>
      <p>
        Kişiyi <strong>Düzenle</strong> ile açtığınızda, formun altında <strong>İzinler</strong>{" "}
        bölümü çıkar. Buradan kişinin izinli olduğu tarih aralıklarını ekleyebilirsiniz:
      </p>
      <ul>
        <li>
          <strong>Başlangıç / Bitiş</strong> tarihlerini seçip <strong>“+ İzin Ekle”</strong> deyin.
        </li>
        <li>Eklenen izinler üstteki listede görünür; yanlış girileni “Sil” ile kaldırabilirsiniz.</li>
      </ul>
      <p>
        <strong>İzinli günlerde kişinin bağlı olduğu ekibin günlük kapasitesi düşer.</strong> Yani o
        gün ekip daha az kapı takabilir; planlama bunu otomatik hesaba katar.
      </p>

      <h2>Kişilerin planlamaya etkisi</h2>
      <ul>
        <li>
          Bir ekibe ne kadar çok kişi eklenirse, ekibin <strong>kişi sayısı (headcount)</strong> o
          kadar artar. Kapasite kuralları kişi sayısını kullandığından, kalabalık ekip günde daha çok
          iş çıkarır.
        </li>
        <li>
          İzinler, yalnızca izin günlerinde ilgili ekibin kapasitesini düşürür — kalıcı bir değişiklik
          değildir.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Bir kişiyi <strong>ekibe üye yapmak</strong> için Kişiler değil, <strong>Ekipler</strong>{" "}
          sayfasındaki “Üyeler” listesini kullanın.
        </li>
        <li>
          Kişi işten ayrıldıysa <strong>Sil</strong> edebilirsiniz; ancak geçmişteki montaj kayıtları
          (kimin taktığı) korunur — geçmiş bozulmaz.
        </li>
        <li>
          Geçici yokluk (yıllık izin, rapor vb.) için kişiyi silmek yerine <strong>İzin</strong>{" "}
          eklemek doğru yöntemdir.
        </li>
      </ul>
    </div>
  );
}
