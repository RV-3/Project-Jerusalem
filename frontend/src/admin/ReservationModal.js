import React from 'react'
import Modal from 'react-modal'
import useTranslate from '../useTranslate'  // adjust path if needed

export default function ReservationModal({
  isOpen,
  onClose,
  reservation,
  onDelete
}) {
  const t = useTranslate()

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={t({
        en: 'Reservation Info',
        de: 'Reservierungsdetails',
        es: 'Información de la reserva'
      })}
      style={{
        overlay: { backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 },
        content: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '25px',
          borderRadius: '8px',
          background: 'white',
          width: '400px'
        }
      }}
    >
      <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
        {t({
          en: 'Reservation Details',
          de: 'Reservierungsdetails',
          es: 'Detalles de la reserva'
        })}
      </h3>

      {reservation && (
        <div style={{ fontSize: '1rem' }}>
          <p>
            <strong>{t({ en: 'Name:', de: 'Name:', es: 'Nombre:' })}</strong>{' '}
            {reservation.name}
          </p>
          <p>
            <strong>{t({ en: 'Phone:', de: 'Telefon:', es: 'Teléfono:' })}</strong>{' '}
            {reservation.phone}
          </p>

          {/* Optional: Show chapel name if the reservation doc has a reference like "chapel.name" */}
          {reservation.chapel?.name && (
            <p>
              <strong>{t({ en: 'Chapel:', de: 'Kapelle:', es: 'Capilla:' })}</strong>{' '}
              {reservation.chapel.name}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button
          className="modern-button modern-button--danger"
          onClick={onDelete}
          style={{ marginRight: '10px' }}
        >
          {t({ en: 'Delete', de: 'Löschen', es: 'Eliminar' })}
        </button>
        <button className="modern-button" onClick={onClose}>
          {t({ en: 'Close', de: 'Schließen', es: 'Cerrar' })}
        </button>
      </div>

      <style>{`
        .modern-button {
          display: inline-block;
          padding: 0.7rem 1.3rem;
          border: none;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            #2A2A2A 0%,
            #1D1D1D 100%
          );
          color: #fff;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.3s ease, transform 0.2s ease;
          box-shadow: 0 4px 8px rgba(0,0,0,0.25);
        }
        .modern-button:hover {
          background: linear-gradient(
            135deg,
            #343434 0%,
            #232323 100%
          );
          transform: scale(1.02);
        }
        .modern-button:active {
          transform: scale(0.98);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .modern-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .modern-button--danger {
          background: linear-gradient(
            135deg,
            #a42b2b 0%,
            #741f1f 100%
          ) !important;
        }
        .modern-button--danger:hover {
          background: linear-gradient(
            135deg,
            #bb3b3b 0%,
            #8f2727 100%
          ) !important;
        }
      `}</style>
    </Modal>
  )
}
