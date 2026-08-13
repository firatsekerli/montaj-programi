/** Kullanma Kılavuzu — "Panel" (ana sayfa) bölümü. */
export function DashboardGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Panel</strong>, uygulamanın ana sayfasıdır ve genel bir bakış sunar: temel sayılar, ay
        boyunca planlanan işlerin takvimi ve kapı tiplerinin güncel günlük kapasiteleri. Buradan hızlıca
        “bu ay ne durumdayız?” sorusuna yanıt alırsınız.
      </p>

      <h2>Özet sayılar</h2>
      <p>Sayfanın üstünde dört kutu bulunur:</p>
      <ul>
        <li>
          <strong>Sipariş:</strong> Sistemdeki toplam sipariş sayısı.
        </li>
        <li>
          <strong>Kapı Tipi:</strong> Tanımlı ürün tipi sayısı.
        </li>
        <li>
          <strong>Ekip:</strong> Tanımlı ekip sayısı.
        </li>
        <li>
          <strong>Araç/Ekipman:</strong> Filodaki araç ve ekipman sayısı.
        </li>
      </ul>

      <h2>Aylık takvim</h2>
      <p>
        Ortadaki takvim, seçili ayda <strong>hangi gün hangi işlerin</strong> planlandığını gösterir.
        Her gün hücresinde o güne düşen işler <strong>sipariş numarası, ekip ve adet</strong> ile
        listelenir. <strong>Bugün</strong> vurgulanır. Üstteki oklarla önceki/sonraki aya geçebilirsiniz.
      </p>
      <p>
        Bu, planın <strong>aylık kuş bakışı</strong> görünümüdür; günü gününe düzenleme{" "}
        <strong>Planlama</strong> sayfasında yapılır.
      </p>

      <h2>Kapasite motoru — canlı örnek</h2>
      <p>
        Alttaki tablo, her kapı tipinin <strong>mesaisiz</strong> ve <strong>mesaili</strong> günlük
        montaj adedini gösterir. Bu değerler, <strong>Kapı Tipleri</strong> ve{" "}
        <strong>Kapasite Kuralları</strong> sayfalarındaki ayarlardan <strong>canlı</strong> hesaplanır
        — hiçbir değer koda gömülü değildir. Yani bir kapı tipinin kapasitesini değiştirirseniz burada
        anında yansır.
      </p>

      <h2>Yazdır</h2>
      <p>
        Sağ üstteki <strong>Yazdır</strong> ile aylık takvimi kâğıda dökebilirsiniz (A4 yatay).
      </p>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Panel bir <strong>özet</strong> ekranıdır; sipariş girme, taşıma, montaj kaydı gibi işlemler
          ilgili sayfalarda (Siparişler, Planlama) yapılır.
        </li>
        <li>
          Takvimdeki işler, en son oluşturulan planı yansıtır. Değişiklik yaptıysanız güncel görünüm
          için <strong>Planlama → “Yeniden Oluştur”</strong> gerekebilir.
        </li>
      </ul>
    </div>
  );
}
