/** Kullanma Kılavuzu — "Kapı Tipleri" bölümü. */
export function WorkItemTypesGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Kapı Tipleri</strong>, firmanın monte ettiği ürün tiplerini ve her birinin{" "}
        <strong>günlük montaj kapasitesini</strong> tanımlar. Bir siparişe kalem eklerken buradaki
        tipler seçilir; planlayıcı da her tipin kapasitesini kullanarak “bu iş kaç gün sürer” hesabını
        yapar.
      </p>

      <h2>Liste ekranı</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Kapı tipinin adı (etiket olarak gösterilir).
        </li>
        <li>
          <strong>Kod:</strong> Kısa kod (ör. <em>FD_FF_SL</em>).
        </li>
        <li>
          <strong>Kapasite Modeli:</strong> Kapasitenin nasıl hesaplandığı (Adet ya da Efor).
        </li>
        <li>
          <strong>Mesaisiz / Mesaili (adet/gün):</strong> Normal ve mesaili günde takılabilen adet.
        </li>
      </ul>
      <p>
        Sağ üstteki <strong>“Yeni Tip”</strong> ile yeni kapı tipi eklenir.
      </p>

      <h2>Temel alanlar</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Ürün adı (ör. <em>Tam Kasalı Tek Kanatlı Yangın Kapısı</em>).
        </li>
        <li>
          <strong>Kod:</strong> Kısa, benzersiz kod.
        </li>
        <li>
          <strong>Kategori:</strong> İsteğe bağlı gruplama.
        </li>
      </ul>

      <h2>Kapasite Modeli</h2>
      <p>Kapasitenin iki hesaplama yolu vardır:</p>
      <ul>
        <li>
          <strong>Adet (sayı/gün):</strong> En basit ve en sık kullanılan yöntem. Doğrudan{" "}
          <strong>Mesaisiz</strong> ve <strong>Mesaili</strong> günlük adetleri girersiniz (ör. günde
          10 adet).
        </li>
        <li>
          <strong>Efor (saat/adet):</strong> Süre boyuta göre değişiyorsa kullanılır. Süre ={" "}
          <em>temel saat + katsayı × özellik</em> formülüyle hesaplanır. Örneğin endüstriyel kapı:{" "}
          <em>4.3125 + 0.1875 × alan(m²)</em>. Özellik alanına <em>area_m2</em> gibi bir değer yazılır.
        </li>
      </ul>

      <h2>Ekip ölçeklemesi</h2>
      <p>
        Girdiğiniz günlük adetler <strong>kaç kişilik ekip</strong> içindir ve ekip büyüdükçe kapasite
        nasıl artar, bunu iki alan belirler:
      </p>
      <ul>
        <li>
          <strong>Temel ekip kişi sayısı:</strong> Yukarıdaki adetler bu kişi sayısı içindir (Dimak’ta
          2 kişi).
        </li>
        <li>
          <strong>Kişi başı ek adet:</strong> Bu sayının üzerindeki her kişi için günde kaç adet
          eklenir (ör. yangın kapısı 2, endüstriyel 1).
        </li>
      </ul>
      <p>
        Böylece motor, montaj adedini ekipteki kişi sayısına göre hesaplar. Ekip formundaki{" "}
        <strong>“günlük adet”</strong> yalnızca doldurulduğunda bu hesabı geçersiz kılar.
      </p>

      <h2>Gerekli kaynak</h2>
      <p>
        Bu tipi monte etmek paylaşılan bir ekipman gerektiriyorsa adı yazılır (ör. endüstriyel kapı
        için <em>manlift</em>). <strong>Araçlar</strong> sayfasında aynı adı taşıyan ekipman sayısı, bu
        tipi <strong>aynı gün kaç ekibin</strong> monte edebileceğini sınırlar. Boş = kısıt yok.
      </p>

      <h2>Aynı şantiyede birden çok ekip</h2>
      <ul>
        <li>
          <strong>Açık:</strong> Bu tipte birden çok ekip aynı şantiyeye paralel girip işi daha erken
          bitirebilir (ör. endüstriyel, seksiyonel).
        </li>
        <li>
          <strong>Kapalı:</strong> Bir şantiyeye tek ekip girer (ör. yangın kapısı); ikinci ekip
          yalnızca teslim tarihine yetişme baskısı varsa eklenir.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Bir tipin kapasitesini değiştirmek, o tipi içeren tüm işlerin süresini etkiler — değişiklik
          sonrası <strong>Planlama → “Yeniden Oluştur”</strong> demeyi unutmayın.
        </li>
        <li>
          Bir ekip bir tipi takabilmek için <strong>Ekipler</strong> sayfasında o tipi
          “Yetkinlikler”de işaretlemiş olmalıdır.
        </li>
        <li>
          Kapasite kuralları (büyük kanat, kırım vb.) bu temel kapasitenin üzerine uygulanır —{" "}
          <strong>Kapasite Kuralları</strong> bölümüne bakın.
        </li>
      </ul>
    </div>
  );
}
