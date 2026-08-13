/** Kullanma Kılavuzu — "Ekipler" bölümü. */
export function TeamsGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Ekipler</strong> sayfası, işleri sahada yapacak montaj ekiplerini tanımlar. Bir ekibin{" "}
        <strong>üyeleri</strong>, <strong>monte edebildiği kapı tipleri</strong>,{" "}
        <strong>başlangıç konumu</strong> ve <strong>önceliği</strong>, planlayıcının işleri hangi
        ekibe, hangi güne dağıtacağını doğrudan belirler.
      </p>

      <h2>Liste ekranı</h2>
      <ul>
        <li>
          <strong>Ekip:</strong> Ekibin adı; altında küçük yazıyla türü (Kendi Ekibimiz / Taşeron).
        </li>
        <li>
          <strong>Üyeler:</strong> Ekipteki kişiler (etiketler halinde).
        </li>
        <li>
          <strong>Yetkinlikler:</strong> Ekibin monte edebildiği kapı tipleri (etiketler halinde).
        </li>
        <li>
          <strong>Düzenle / Sil:</strong> Ekibi düzenlemek veya kaldırmak için.
        </li>
      </ul>
      <p>
        Sağ üstteki <strong>“Yeni Ekip”</strong> butonuyla yeni ekip eklenir.
      </p>

      <h2>Yeni ekip ekleme — alanlar</h2>
      <ul>
        <li>
          <strong>Ekip:</strong> Ekibin adı (ör. <em>KAZIM EKİBİ</em>).
        </li>
        <li>
          <strong>Tür:</strong> <em>Montaj Ekibi</em> ya da <em>Sevkiyat Ekibi</em>. Sevkiyat ekipleri
          montaj planına ve panoya <strong>çıkmaz</strong>; onlara her montaj için “sevk et” görevi
          düşer.
        </li>
        <li>
          <strong>Taşeron mu?:</strong> Ekip taşeronsa işaretlenir.
        </li>
        <li>
          <strong>Öncelik ağırlığı:</strong> Planlayıcı <strong>düşük ağırlıklı ekipleri önce</strong>{" "}
          kullanır. Kendi ekiplerinize düşük (ör. <em>10</em>), taşeronlara yüksek (ör. <em>100</em>)
          verin — böylece taşeron yalnızca kendi ekipleriniz yetmediğinde devreye girer.
        </li>
        <li>
          <strong>Başlangıç konumu:</strong> Ekibin her gün yola çıktığı ve döndüğü nokta
          (depo/fabrika). Şantiyelere mesafe buradan hesaplanır ve günlük montaj kapasitesini etkiler.
          Listede yoksa <strong>“+ Yeni konum ekle”</strong> ile ekleyebilirsiniz (enlem/boylam
          girerseniz mesafe doğru hesaplanır).
        </li>
      </ul>

      <h3>Üyeler</h3>
      <p>
        Ekibe dahil kişileri işaretleyin. Kişiler <strong>Kişiler</strong> sayfasından gelir. Bir
        ekipte ne kadar çok kişi varsa, ekibin <strong>günlük kapasitesi</strong> o kadar yüksek olur;
        üyelerden birinin izinli olduğu gün ise kapasite o gün düşer.
      </p>

      <h3>Yetkinlikler</h3>
      <p>
        Ekibin <strong>hangi kapı tiplerini</strong> monte edebildiğini işaretleyin. Planlayıcı bir işi
        yalnızca o tipi yapabilen ekiplere verir. Her tipin yanındaki <strong>“günlük adet”</strong>{" "}
        kutusu isteğe bağlıdır: doldurursanız, o ekibin o tipten günde kaç adet takabileceğini{" "}
        <strong>sabitler</strong> (ör. taşeron 2/gün). Boş bırakırsanız kapasiteyi motor hesaplar.
      </p>

      <h2>Ekiplerin planlamaya etkisi — özet</h2>
      <ul>
        <li>
          <strong>Öncelik ağırlığı:</strong> Kimin önce kullanılacağını belirler (düşük = önce).
        </li>
        <li>
          <strong>Yetkinlikler:</strong> Ekibin hangi işleri alabileceğini belirler.
        </li>
        <li>
          <strong>Üye sayısı:</strong> Günlük iş çıkarma hızını (kapasiteyi) yükseltir.
        </li>
        <li>
          <strong>Başlangıç konumu:</strong> Şantiyeye uzaklık, yol süresini ve dolayısıyla o gün
          takılabilecek adedi etkiler.
        </li>
        <li>
          <strong>Günlük adet (yetkinlikte):</strong> Bir tip için ekibin günlük montajını elle
          sabitler.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Aynı kapı tipini birden çok ekip yapabiliyorsa, planlayıcı işi <strong>önceliği düşük</strong>{" "}
          (kendi) ekibe verir; kapasite yetmezse bir üst önceliğe geçer.
        </li>
        <li>
          Bir ekibi <strong>Sevkiyat</strong> yaparsanız montaj panosundan kalkar; yalnızca sevk
          görevleri Bildirimler’de çıkar.
        </li>
        <li>
          Üye ve yetkinlikler, ilgili kişi/kapı tipi kayıtlarından beslenir — önce{" "}
          <strong>Kişiler</strong> ve <strong>Kapı Tipleri</strong> tanımlı olmalıdır.
        </li>
      </ul>
    </div>
  );
}
