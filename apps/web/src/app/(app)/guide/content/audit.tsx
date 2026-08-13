/** Kullanma Kılavuzu — "Geçmiş" (İşlem Geçmişi) bölümü. */
export function AuditGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Geçmiş</strong> sayfası, sistemde yapılan her önemli değişikliğin kaydını tutar:
        <strong> kim, ne zaman, neyi değiştirdi.</strong> En yeni işlem en üstte görünür. Bir hatanın
        ne zaman ve kim tarafından yapıldığını bulmak ya da “bu sipariş neden değişti?” gibi soruları
        yanıtlamak için kullanılır.
      </p>

      <h2>Sütunlar</h2>
      <ul>
        <li>
          <strong>Zaman:</strong> İşlemin yapıldığı tarih ve saat.
        </li>
        <li>
          <strong>Kullanıcı:</strong> İşlemi yapan kişi (o an giriş yapmış olan kullanıcının adı).
        </li>
        <li>
          <strong>İşlem:</strong> Ne yapıldığı — ör. “Siparişi güncelledi”, “İşi başka güne/ekibe
          taşıdı”.
        </li>
        <li>
          <strong>Sipariş:</strong> İşlemin ilgili olduğu sipariş numarası (varsa).
        </li>
        <li>
          <strong>Detay:</strong> Ek bilgi — montaj adedi (ör. <em>3/8</em>), hedef tarih (ör.{" "}
          <em>→ 14 Ağu 2026</em>) ya da montajı yapan kişiler (ör. <em>Takan: MURAT</em>).
        </li>
      </ul>

      <h2>Filtreler</h2>
      <p>Üstteki filtrelerle kayıtları daraltabilirsiniz. Hepsi aynı anda birlikte kullanılabilir:</p>
      <ul>
        <li>
          <strong>Kullanıcı:</strong> Yalnızca belirli bir kişinin yaptığı işlemler.
        </li>
        <li>
          <strong>İşlem türü:</strong> Yalnızca belirli tür işlemler (ör. sadece taşımalar, sadece
          montaj girişleri).
        </li>
        <li>
          <strong>Sipariş:</strong> Sipariş numarasına göre arama — yazdıkça listeyi süzer.
        </li>
        <li>
          <strong>Takan:</strong> Montajı yapan kişiye göre — seçilen kişinin taktığı işleri gösterir.
        </li>
      </ul>

      <h2>Daha fazla yükle</h2>
      <p>
        Sayfa ilk <strong>50 kaydı</strong> gösterir. Liste uzarsa alttaki{" "}
        <strong>“Daha fazla yükle”</strong> butonuyla 50’şer kayıt daha eklenir. Herhangi bir filtre
        değişince liste baştan yüklenir.
      </p>

      <h2>Hangi işlemler kaydedilir?</h2>
      <ul>
        <li>
          <strong>Sipariş:</strong> oluşturma, güncelleme, silme, planlama dışı bırakma (engelleme) ve
          geri alma.
        </li>
        <li>
          <strong>Planlama:</strong> işi başka güne/ekibe taşıma, toplu taşıma, montaj adedi girme,
          montaj girişini geri alma.
        </li>
        <li>
          <strong>Plan:</strong> planı yeniden oluşturma, planı temizleme.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Kayıtlar <strong>değiştirilemez ve silinemez</strong> — yalnızca yeni kayıt eklenir. Bu,
          geçmişin güvenilir bir denetim kaydı olarak kalmasını sağlar.
        </li>
        <li>
          İşlemi yapanın adı kaydın içine yazıldığı için, kullanıcı sonradan değişse veya silinse bile
          geçmiş bozulmaz.
        </li>
        <li>
          <strong>Takan</strong> bilgisi, montaj adedi girilirken özel kişi(ler) seçildiyse görünür;
          seçilmediyse işi ekibin taktığı varsayılır.
        </li>
      </ul>
    </div>
  );
}
