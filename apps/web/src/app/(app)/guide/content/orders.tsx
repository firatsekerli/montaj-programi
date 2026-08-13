/** Kullanma Kılavuzu — "Siparişler" bölümü. */
export function OrdersGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Siparişler</strong>, montajı yapılacak işlerin girildiği yerdir. Her sipariş; müşteri,
        konum, tarihler ve <strong>kapı kalemleri</strong> (hangi tipten kaç adet) içerir. Planlama bu
        siparişleri temel alır — bir sipariş girildiğinde, teslim tarihine ve kapasiteye göre otomatik
        olarak ekiplere ve günlere dağıtılır.
      </p>

      <h2>Liste ekranı</h2>
      <p>Siparişler teslim tarihine göre sıralı gelir (en yakın önce). Üstteki araçlarla süzebilirsiniz:</p>
      <ul>
        <li>
          <strong>Arama:</strong> Sipariş numarasına göre.
        </li>
        <li>
          <strong>Durum çipleri:</strong> Tümü / Bekleyen / Planlandı / Devam ediyor / Tamamlandı /
          Engellendi — her birinin yanında adet sayacı.
        </li>
        <li>
          <strong>İlçe filtresi:</strong> Belirli bir Ankara ilçesindeki siparişler.
        </li>
      </ul>
      <p>Tablodaki sütunlar: Sipariş No, İlçe, Sipariş Tarihi, Teslim Tarihi, Üretim Tamamlanma, Kalemler (kırım/sökme varsa rozet), Durum ve Düzenle/Sil.</p>

      <h2>Yeni sipariş — alanlar</h2>
      <ul>
        <li>
          <strong>Sipariş No:</strong> İşin numarası (zorunlu).
        </li>
        <li>
          <strong>Müşteri (Ad / Soyad / Telefon):</strong> İsteğe bağlı iletişim bilgileri.
        </li>
        <li>
          <strong>İlçe (Ankara):</strong> Montajın yapılacağı ilçe. Seyahat süresi ilçenin merkez
          koordinatından otomatik hesaplanır.
        </li>
        <li>
          <strong>Giriş Süresi (dk):</strong> Güvenlik/giriş için kaybedilen dakika (ör. Roketsan =
          120). Bu süre o günkü montaj kapasitesini azaltır.
        </li>
        <li>
          <strong>Sipariş Tarihi:</strong> Siparişin alındığı tarih. (Teslim tarihinden sonra olamaz.)
        </li>
        <li>
          <strong>Teslim Tarihi:</strong> Montajın tamamlanması gereken tarih. Üretim tamamlanma
          tarihi buna göre geriye doğru hesaplanır.
        </li>
        <li>
          <strong>Üretim Tamamlanma:</strong> Sistem tarafından <strong>hesaplanır</strong> — üretimin
          en geç ne zaman bitmesi gerektiğini gösterir (bilgi amaçlı).
        </li>
      </ul>

      <h3>Sipariş kalemleri</h3>
      <p>
        <strong>“Kalem Ekle”</strong> ile her satıra bir <strong>kapı tipi</strong> ve{" "}
        <strong>adet</strong> girin. Kapı tipleri <strong>Kapı Tipleri</strong> sayfasından gelir; her
        tip bir siparişte en fazla bir kez yer alır.
      </p>

      <h3>İşaret kutuları</h3>
      <ul>
        <li>
          <strong>Kapı sökme / duvar kırma var mı?:</strong> İşaretlenirse iş daha yavaş planlanır ve
          listede “Kırım/Sökme” rozetiyle görünür.
        </li>
        <li>
          <strong>Üretim hazır (tarihe bakılmaksızın planlanabilir):</strong> İşaretliyse üretim
          beklenmeden hemen planlamaya alınabilir.
        </li>
        <li>
          <strong>Manlift gerekli mi?:</strong> (Endüstriyel gibi manlift gerektiren kalemler varsa
          görünür.) İşaretliyse bu sipariş manlift havuzundan bir adet ayırır ve aynı gün paralel ekip
          sayısını sınırlar.
        </li>
        <li>
          <strong>Engellendi — planlamaya dahil etme:</strong> İşaretlenirse sipariş{" "}
          <strong>planlamaya alınmaz</strong> (aşağıya bakın).
        </li>
      </ul>

      <h2>Durum nasıl belirlenir?</h2>
      <p>
        Durum <strong>otomatik</strong> belirlenir — elle seçmezsiniz. Montaj ilerledikçe kendiliğinden
        değişir:
      </p>
      <ul>
        <li>
          <strong>Bekleyen:</strong> Henüz plana girmemiş.
        </li>
        <li>
          <strong>Planlandı:</strong> Plana girmiş, kartları oluşmuş.
        </li>
        <li>
          <strong>Devam ediyor:</strong> Bazı kapılar takıldı olarak işaretlenmiş.
        </li>
        <li>
          <strong>Tamamlandı:</strong> Tüm kapılar takılmış.
        </li>
        <li>
          <strong>Engellendi:</strong> Tek <strong>elle</strong> ayarlanan durum. Listede{" "}
          <strong>“Engelle / Geri al”</strong> ile açıp kapatırsınız. Engelli sipariş planlamaya
          alınmaz — ör. eksik ölçü/malzeme nedeniyle bekletmek istediğinizde kullanılır.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Sipariş eklendiğinde/değiştiğinde planlama etkilenir; güncel planı görmek için{" "}
          <strong>Planlama → “Yeniden Oluştur”</strong> gerekebilir.
        </li>
        <li>
          Bir siparişi tamamen kaldırmak için <strong>Sil</strong>, geçici olarak plandan çıkarmak için{" "}
          <strong>Engelle</strong> kullanın.
        </li>
        <li>
          Teslim tarihi çok yakınsa ve üretim yetişmiyorsa sistem bir <strong>uyarı</strong> üretir
          (Bildirimler’de görünür).
        </li>
      </ul>
    </div>
  );
}
