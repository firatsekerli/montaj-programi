/** Kullanma Kılavuzu — "Araçlar ve Ekipman" bölümü. */
export function AssetsGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Araçlar ve Ekipman</strong> sayfası, firmanın <strong>araç filosunu</strong>{" "}
        (kamyonetler) ve <strong>ekipmanlarını</strong> (manlift/sepet gibi) yönetir. Buradaki bilgiler
        yalnızca bir kayıt tutmak için değildir — <strong>taşıma kapasitesi</strong>,{" "}
        <strong>paylaşılan kaynaklar</strong> ve <strong>konum takibi</strong> doğrudan planlamayı
        etkiler.
      </p>

      <h2>Liste ekranı</h2>
      <p>Sayfa açıldığında tüm araç ve ekipmanlar bir tabloda listelenir:</p>
      <ul>
        <li>
          <strong>Ad:</strong> Aracın plakası ya da ekipmanın adı (ör. <em>06 EOU 205</em>,{" "}
          <em>MANLIFT DİMAK</em>).
        </li>
        <li>
          <strong>Tür:</strong> Araç mı, Ekipman mı.
        </li>
        <li>
          <strong>Konum Takibi:</strong> Bu kalemin yeri takip ediliyor mu (Evet / —).
        </li>
        <li>
          <strong>Mevcut Konum:</strong> Şu an nerede olduğu (ör. <em>Dimak Fabrika</em>).
        </li>
        <li>
          <strong>Düzenle / Sil:</strong> Kaydı düzenlemek veya kaldırmak için.
        </li>
      </ul>
      <p>
        Sağ üstteki <strong>“Yeni Araç/Ekipman”</strong> butonuyla yeni kayıt eklenir.
      </p>

      <h2>Yeni araç/ekipman ekleme — alanlar</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Plaka veya ekipman adı.
        </li>
        <li>
          <strong>Tür:</strong> <em>Araç</em> (montaj ekibini ve malzemeyi taşıyan kamyonet) ya da{" "}
          <em>Ekipman</em> (manlift gibi).
        </li>
        <li>
          <strong>Mevcut Konum:</strong> Kalemin bulunduğu yer.
        </li>
        <li>
          <strong>Konumu takip edilsin mi?:</strong> İşaretlenirse bu kalemin yeri izlenir — örneğin
          şantiyeler arasında dolaşan bir manlift için kullanışlıdır.
        </li>
      </ul>

      <h3>Filo ve kapasite</h3>
      <ul>
        <li>
          <strong>Bağlı ekip:</strong> Bu araç hangi ekibin aracıysa o seçilir. Ekip bir işe
          atandığında bu araç da atamaya yazılır ve taşıma kapasitesi o ekibi sınırlar.
        </li>
        <li>
          <strong>Paylaşılan kaynak türü:</strong> Ekipman ortak bir havuzun parçasıysa türü yazılır
          (ör. <em>manlift</em>). Aynı türden kaç ekipman varsa, o kaynağı gerektiren kapı tipini{" "}
          <strong>aynı gün en fazla o kadar ekip</strong> monte edebilir. Örneğin 2 manlift varsa,
          endüstriyel kapıyı aynı gün en çok 2 ekip takabilir.
        </li>
      </ul>

      <h3>Taşıma kapasitesi</h3>
      <p>
        Aracın <strong>kapı tipi başına</strong> taşıdığı adet ve boyut sınırları:
      </p>
      <ul>
        <li>
          <strong>Azami adet:</strong> Bu araç o tipten günde en fazla kaç kapı taşıyabilir. Planlayıcı,
          ekibin o tipten <strong>günlük montajını bu sayıyla sınırlar.</strong>
        </li>
        <li>
          <strong>Asgari adet / Azami boy (m):</strong> İsteğe bağlı ek sınırlar. Boş bırakılan alan{" "}
          <strong>“sınır yok”</strong> demektir.
        </li>
      </ul>

      <h3>Bağımlılıklar</h3>
      <p>
        Bir ekipmanın çalışması için gereken diğer araç/ekipmanlar işaretlenir. Örneğin bir manlift
        sepette taşınır, sepet de kamyonete bağlanır. Bu bağ, planlama sırasında birbirine bağlı
        ekipmanların birlikte düşünülmesini sağlar.
      </p>

      <h2>Konum takibi ve manlift transferi</h2>
      <p>
        Konumu takip edilen ekipmanlar için sistem, <strong>“Manlift transferi”</strong> bildirimleri
        üretebilir: bir sonraki montaj başka bir şantiyedeyse, ekipmanın oraya taşınması gerektiği
        önceden hatırlatılır. Bu bildirimler <strong>Bildirimler</strong> sayfasında görünür.
      </p>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          <strong>Taşıma kapasitesi = günlük montaj sınırı.</strong> Bir tipten “azami adet”i
          düşürürseniz, o ekip o tipten günde daha az kapı takabilir — plandaki günler buna göre
          şekillenir.
        </li>
        <li>
          Paylaşılan kaynak (manlift) sayısı, o kaynağı gerektiren işlerin{" "}
          <strong>aynı gün kaç paralel ekiple</strong> yapılabileceğini belirler.
        </li>
        <li>
          Liste ekranında konum yalnızca <strong>görüntülenir</strong>; konumu değiştirmek için ilgili
          satırın <strong>Düzenle</strong> butonunu kullanın.
        </li>
      </ul>
    </div>
  );
}
