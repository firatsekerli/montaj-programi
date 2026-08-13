/** Kullanma Kılavuzu — "Bildirimler" bölümü. */
export function NotificationsGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Bildirimler</strong>, operasyonun takip etmesi gereken görevleri tek listede toplar:
        üretim hatırlatmaları, manlift transferleri, teslim riski uyarıları ve sevkiyat görevleri. Bu
        görevler sistem tarafından <strong>otomatik</strong> oluşturulur — siparişler ve plan
        değiştikçe kendiliğinden güncellenir.
      </p>

      <h2>Görev nasıl kapatılır?</h2>
      <p>
        Her görevin başında bir <strong>kutucuk</strong> vardır. İş yapıldığında kutucuğu işaretleyin —
        görev “Tamamlanan” olarak işaretlenir. Yanlışlıkla işaretlediyseniz, işareti tekrar kaldırarak
        görevi geri açabilirsiniz.
      </p>

      <h2>Görev türleri</h2>
      <ul>
        <li>
          <strong>Üretim:</strong> Bir siparişin üretiminin belirli bir tarihe kadar tamamlanması
          gerektiğini hatırlatır.
        </li>
        <li>
          <strong>Manlift transferi:</strong> Bir sonraki montaj başka bir şantiyedeyse, manlifti oraya
          taşımanız gerektiğini önceden bildirir.
        </li>
        <li>
          <strong>Teslim riski:</strong> Üretim/montaj teslim tarihine yetişmeyecek görünüyorsa uyarır.
        </li>
        <li>
          <strong>Sevkiyat:</strong> Sevkiyat ekibine düşen “sevk et” görevleri.
        </li>
      </ul>
      <p>Görevler türlerine göre başlıklar altında gruplanır; her görevde tür etiketi, sipariş numarası, son tarih ve kısa bir açıklama bulunur.</p>

      <h2>Filtreler</h2>
      <p>Uzun listeyi daraltmak için üstteki araçları birlikte kullanabilirsiniz:</p>
      <ul>
        <li>
          <strong>Tür çipleri:</strong> Tümü / Üretim / Manlift transferi / Teslim riski / Sevkiyat —
          her birinde adet sayacı. Ayrıca sağdaki <strong>“Tamamlanan”</strong> ile kapatılmış
          görevleri görebilirsiniz.
        </li>
        <li>
          <strong>Sipariş araması:</strong> Sipariş numarasına göre süzer.
        </li>
        <li>
          <strong>Sadece geciken:</strong> İşaretlenince yalnızca son tarihi geçmiş açık görevler
          görünür.
        </li>
        <li>
          <strong>Son tarih aralığı:</strong> Başlangıç–Bitiş tarihi seçerek görevleri son tarihine
          göre süzer.
        </li>
        <li>
          <strong>Filtreleri temizle:</strong> Aktif filtreleri tek tıkla sıfırlar.
        </li>
      </ul>

      <h2>Daha fazla yükle</h2>
      <p>
        Sayfa ilk <strong>15 görevi</strong> gösterir; alttaki <strong>“Daha fazla yükle”</strong> ile
        15’er görev daha eklenir. Herhangi bir filtre değişince liste baştan yüklenir.
      </p>

      <h2>Geciken görevler</h2>
      <p>
        Son tarihi geçmiş açık görevler <strong>kırmızı</strong> gösterilir ve listede en üste alınır.
        “Sadece geciken” filtresiyle bunları hızlıca toplayabilirsiniz.
      </p>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Görevleri <strong>siz oluşturmazsınız</strong> — sistem, siparişlerden ve plandan üretir. İş
          bitince yalnızca kutucuğu işaretlemeniz yeterlidir.
        </li>
        <li>
          Bir sipariş değişir ya da plan yeniden oluşturulursa, artık gereksiz kalan görevler otomatik
          kalkar; yeni gerekenler eklenir.
        </li>
        <li>
          Manlift transferi bildirimleri, ekipmanın <strong>konum takibinin</strong> açık olmasına
          bağlıdır (bkz. Araçlar ve Ekipman).
        </li>
      </ul>
    </div>
  );
}
